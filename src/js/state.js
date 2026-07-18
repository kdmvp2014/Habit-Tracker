import { createClient } from '@supabase/supabase-js';
import { COLORS } from './constants.js';

// ── STATE ─────────────────────────────────────────────────
export let S = {
  habits:  [],  // {id,name,color,cat,note,freq,freqDays}
  logs:    {},  // {"YYYY-MM-DD":{hid:bool}}
  todos:   [],  // {id,title,note,date,cat,prio,done}
  plans:   [],  // {id,name,days:[{exercises:[{name,sets,note,done}]}×7]}  days[0]=Mo
  customFoods: [], // {id,name,kcal100,protein100,carbs100,fat100}
  profile: { birthdate:null, heightCm:null, weightKg:null },
  activePlanId: null,
  viewMonth: null,
  editingHabitId: null,
  editingTodoId:  null,
  selectedColor:  COLORS[0],
  exDay: null,
  exEditIdx: null,
};

// ── AUTH / PERSIST ────────────────────────────────────────
export let currentUser = null;   // {id, email} once a session exists
export let appStarted  = false;  // guards one-time shell setup from re-running
export function setCurrentUser(u){ currentUser = u; }
export function setAppStarted(v){ appStarted = v; }
export function nsKey(base){ return currentUser ? base+'_'+currentUser.id : base; }

export function load(){
  const tryOld = (key,oldKey) => {
    const v=localStorage.getItem(key); if(v) return JSON.parse(v);
    const o=localStorage.getItem(oldKey); return o?JSON.parse(o):null;
  };
  S.habits = tryOld(nsKey('ht3_habits'),'ht2_habits') || [];
  S.logs   = tryOld(nsKey('ht3_logs'),  'ht2_logs')   || {};
  S.todos  = tryOld(nsKey('ht3_todos'), 'ht2_todos')  || [];
  S.plans  = JSON.parse(localStorage.getItem(nsKey('ht3_plans'))||'[]');
  S.customFoods = JSON.parse(localStorage.getItem(nsKey('ht3_customfoods'))||'[]');
  S.profile = JSON.parse(localStorage.getItem(nsKey('ht3_profile'))||'null') || { birthdate:null, heightCm:null, weightKg:null };
  S.activePlanId = localStorage.getItem(nsKey('ht3_activePlan'))||null;
  if(!S.activePlanId && S.plans.length) S.activePlanId = S.plans[0].id;
}

// Alle drei Profil-Felder müssen gesetzt sein, sonst gilt das Setup als nicht abgeschlossen
export function hasProfile(){
  return !!(S.profile && S.profile.birthdate && S.profile.heightCm && S.profile.weightKg);
}

// ── SUPABASE AUTH + SYNC ──────────────────────────────────
export const SUPABASE_URL = 'https://oneijrohdxyxbamauyei.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZWlqcm9oZHh5eGJhbWF1eWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODU0NTYsImV4cCI6MjA5OTc2MTQ1Nn0.gAeE222V3esQC7XYEvQaZJrR4--GD8XIv0eZj4TTtek';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── USDA FOODDATA CENTRAL (generische/rohe Lebensmittel) ────
// Kostenlosen Key holen: https://fdc.nal.usda.gov/api-key-signup/
// Bewusst NICHT hier im Code (öffentliches Repo!) — wird per Button in der App
// einmalig lokal im Browser gespeichert (localStorage), siehe setUsdaApiKey().
export const USDA_API_KEY = localStorage.getItem('usda_api_key') || '';

let lastSyncTime      = null;
let syncTimeout       = null;

export async function syncToSupabase(){
  if(!currentUser) return;
  try {
    const payload = {
      user_id:      currentUser.id,
      habits:       JSON.stringify(S.habits),
      logs:         JSON.stringify(S.logs),
      todos:        JSON.stringify(S.todos),
      plans:        JSON.stringify(S.plans),
      custom_foods: JSON.stringify(S.customFoods),
      active_plan:  S.activePlanId||'',
      birthdate:    S.profile.birthdate||null,
      height_cm:    S.profile.heightCm||null,
      weight_kg:    S.profile.weightKg||null,
      updated_at:   new Date().toISOString()
    };
    const { error } = await sb.from('tracker_data').upsert(payload, { onConflict: 'user_id' });
    if(!error){ lastSyncTime = new Date(); updateSyncIndicator(true); }
    else updateSyncIndicator(false);
  } catch(e){ updateSyncIndicator(false); }
}

// Rückgabe: 'ok' (Daten geladen), 'empty' (kein Fehler, nur noch keine Zeile), 'error' (echter Fehler)
export async function loadFromSupabase(){
  if(!currentUser) return 'error';
  try {
    const { data, error } = await sb.from('tracker_data').select('*').eq('user_id', currentUser.id);
    if(error) return 'error';
    if(!data || !data.length) return 'empty';
    const row = data[0];
    if(row.habits)       S.habits      = JSON.parse(row.habits);
    if(row.logs)         S.logs        = JSON.parse(row.logs);
    if(row.todos)        S.todos       = JSON.parse(row.todos);
    if(row.plans)         S.plans      = JSON.parse(row.plans);
    if(row.custom_foods) S.customFoods = JSON.parse(row.custom_foods);
    if(row.active_plan)  S.activePlanId= row.active_plan;
    if(row.birthdate || row.height_cm || row.weight_kg){
      S.profile = { birthdate: row.birthdate||null, heightCm: row.height_cm||null, weightKg: row.weight_kg||null };
    }
    save(); // auch in localStorage spiegeln
    return 'ok';
  } catch(e){ return 'error'; }
}

// Debounced sync — speichert 2 Sek nach letzter Änderung
function debouncedSync(){
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncToSupabase, 2000);
}

// Sync-Indikator in der Sidebar
export function updateSyncIndicator(state){
  const el = document.getElementById('sync-indicator');
  if(!el) return;
  if(state==='pending'){
    el.innerHTML='<span style="color:var(--text2)">verbinde…</span>';
  } else if(state===true){
    const t = lastSyncTime ? lastSyncTime.toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'}) : '';
    el.innerHTML=`<span style="color:var(--green)">sync ${t}</span>`;
  } else {
    el.innerHTML='<span style="color:var(--amber)">sync fehler</span>';
  }
}

export function save(){
  if(!currentUser) return;
  localStorage.setItem(nsKey('ht3_habits'), JSON.stringify(S.habits));
  localStorage.setItem(nsKey('ht3_logs'),   JSON.stringify(S.logs));
  localStorage.setItem(nsKey('ht3_todos'),  JSON.stringify(S.todos));
  localStorage.setItem(nsKey('ht3_plans'),  JSON.stringify(S.plans));
  localStorage.setItem(nsKey('ht3_customfoods'), JSON.stringify(S.customFoods));
  localStorage.setItem(nsKey('ht3_profile'), JSON.stringify(S.profile));
  localStorage.setItem(nsKey('ht3_activePlan'), S.activePlanId||'');
  debouncedSync();
}
