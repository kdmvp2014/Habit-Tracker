import {
  sb, currentUser, setCurrentUser, appStarted, setAppStarted,
  S, load, updateSyncIndicator, loadFromSupabase, syncToSupabase, hasProfile
} from './state.js';
import { DOW_S } from './constants.js';
import { renderHeute } from './heute.js';
import { updateDsThemeIcon } from './nav.js';
import { openProfileSetupModal } from './settings.js';

let pendingResendEmail = null;

// ── AUTH UI ───────────────────────────────────────────────
export function showAuthSection(id){
  document.querySelectorAll('#auth-gate .auth-section').forEach(el=>el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
export function showAuthGate(){
  document.getElementById('app-shell').style.display='none';
  document.getElementById('auth-gate').style.display='block';
  showAuthSection('auth-login');
}
export function showAppShell(){
  document.getElementById('auth-gate').style.display='none';
  document.getElementById('app-shell').style.display='block';
  const emailEl = document.getElementById('sidebar-user-email');
  if(emailEl && currentUser) emailEl.textContent = currentUser.email;
}
function isUnconfirmedError(msg){ return !!msg && /confirm/i.test(msg); }

export async function handleLogin(){
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if(!email || !password){ errEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error){
    if(isUnconfirmedError(error.message)){
      pendingResendEmail = email;
      document.getElementById('unconfirmed-email').textContent = email;
      showAuthSection('auth-unconfirmed');
    } else {
      errEl.textContent = 'Anmeldung fehlgeschlagen: falsche E-Mail oder falsches Passwort.';
    }
  }
  // Erfolg wird über onAuthStateChange behandelt
}

export async function handleSignup(){
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl = document.getElementById('signup-error');
  errEl.textContent = '';
  if(!email || !password){ errEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
  if(password.length < 6){ errEl.textContent = 'Passwort muss mindestens 6 Zeichen haben.'; return; }
  const { error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: location.origin + location.pathname }
  });
  if(error){ errEl.textContent = error.message; return; }
  pendingResendEmail = email;
  document.getElementById('pending-email').textContent = email;
  showAuthSection('auth-pending');
}

export async function handleResend(){
  if(!pendingResendEmail) return;
  const { error } = await sb.auth.resend({ type: 'signup', email: pendingResendEmail });
  const errEl = document.getElementById('pending-error');
  if(errEl) errEl.textContent = error ? error.message : 'Link erneut gesendet.';
}

export async function handleLogout(){
  await sb.auth.signOut();
  // Reload passiert im SIGNED_OUT-Handler von onAuthStateChange
}

sb.auth.onAuthStateChange((event, session) => {
  if(event === 'SIGNED_OUT'){ location.reload(); return; }
  if(session && session.user){
    setCurrentUser({ id: session.user.id, email: session.user.email });
    showAppShell();
    if(!appStarted){ setAppStarted(true); initShellOnce(); }
    loadUserData();
  } else {
    showAuthGate();
  }
});

// ── INIT ─────────────────────────────────────────────────
// Läuft genau einmal pro Seitenaufruf, unabhängig vom Account
async function initShellOnce(){
  updateDsThemeIcon();
  const n=new Date();
  S.viewMonth=new Date(n.getFullYear(),n.getMonth(),1);
  const dateHtml=String(n.getDate()).padStart(2,'0')+'.'+String(n.getMonth()+1).padStart(2,'0')+'.'+n.getFullYear()+'<br>'+DOW_S[n.getDay()];
  document.querySelectorAll('.date-display').forEach(el=>el.innerHTML=dateHtml);
  // Mobile header date
  const mhd=document.getElementById('mobile-header-date');
  if(mhd) mhd.textContent=DOW_S[n.getDay()]+', '+String(n.getDate()).padStart(2,'0')+'.'+String(n.getMonth()+1).padStart(2,'0')+'.';

  // Sync-Indikator in Sidebar + mobilem Menü anzeigen
  document.querySelectorAll('.sidebar-footer').forEach(footer=>{
    const syncEl = document.createElement('div');
    syncEl.className='sync-indicator';
    syncEl.style.cssText='font-family:var(--mono);font-size:10px;margin-top:8px';
    footer.appendChild(syncEl);
  });

  // Service Worker registrieren + Updates aktiv einfordern, statt auf den
  // browser-internen Timer zu warten — sonst bleiben Geräte (v.a. iOS-PWAs),
  // die die App nicht komplett neu starten, auf einem alten SW-Stand hängen.
  if('serviceWorker' in navigator){
    try {
      const reg = await navigator.serviceWorker.register('/sw.js',{scope:'./'});
      reg.update();
      document.addEventListener('visibilitychange', ()=>{
        if(document.visibilityState==='visible') reg.update();
      });
      let reloadedForNewSw = false;
      navigator.serviceWorker.addEventListener('controllerchange', ()=>{
        if(reloadedForNewSw) return;
        reloadedForNewSw = true;
        location.reload();
      });
    } catch(e){ console.log('SW not supported in this context'); }
  }
}

// Läuft jedes Mal, wenn eine Session aktiv wird (Login)
async function loadUserData(){
  load(); // erstmal lokal laden (sofort)
  renderHeute();
  updateSyncIndicator('pending');

  // Im Hintergrund von Supabase laden (aktuellere Daten)
  const status = await loadFromSupabase();
  if(status==='ok'){
    renderHeute();
    updateSyncIndicator(true);
  } else if(status==='empty'){
    // Keine Cloud-Daten vorhanden ist kein Fehler — direkt einen echten
    // Schreibtest machen, damit der Indikator den echten Sync-Status zeigt.
    await syncToSupabase();
  } else {
    updateSyncIndicator(false);
  }

  if(!hasProfile()) openProfileSetupModal();
}
