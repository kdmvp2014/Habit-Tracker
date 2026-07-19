import { S, save, hasProfile } from './state.js';
import { closeModal } from './modal-utils.js';

// ── PROFIL: Vorname, Geburtsdatum, Größe, Gewicht ─────────
function validateProfile(firstName, birthdate, heightCm, weightKg){
  if(!firstName || !firstName.trim()) return 'Bitte Vornamen angeben.';
  if(!birthdate) return 'Bitte Geburtsdatum angeben.';
  if(birthdate > new Date().toISOString().slice(0,10)) return 'Geburtsdatum darf nicht in der Zukunft liegen.';
  const h = parseFloat(heightCm), w = parseFloat(weightKg);
  if(!heightCm || isNaN(h) || h < 50 || h > 250) return 'Größe muss zwischen 50 und 250 cm liegen.';
  if(!weightKg || isNaN(w) || w < 20 || w > 300) return 'Gewicht muss zwischen 20 und 300 kg liegen.';
  return null;
}
function commitProfile(firstName, birthdate, heightCm, weightKg){
  S.profile = { firstName: firstName.trim(), birthdate, heightCm: parseFloat(heightCm), weightKg: parseFloat(weightKg) };
  save();
}

// ── Einstellungen-Ansicht (dauerhaft editierbar) ──────────
export function renderSettings(){
  const p = S.profile || {};
  document.getElementById('settings-firstname').value = p.firstName || '';
  document.getElementById('settings-birthdate').value = p.birthdate || '';
  document.getElementById('settings-height').value = p.heightCm ?? '';
  document.getElementById('settings-weight').value = p.weightKg ?? '';
  document.getElementById('settings-error').textContent = '';
  document.getElementById('settings-saved').textContent = '';
}
export function saveProfileSettings(){
  const firstName = document.getElementById('settings-firstname').value;
  const birthdate = document.getElementById('settings-birthdate').value;
  const heightCm  = document.getElementById('settings-height').value;
  const weightKg  = document.getElementById('settings-weight').value;
  const errEl = document.getElementById('settings-error');
  const err = validateProfile(firstName, birthdate, heightCm, weightKg);
  if(err){ errEl.textContent = err; return; }
  errEl.textContent = '';
  commitProfile(firstName, birthdate, heightCm, weightKg);
  document.getElementById('settings-saved').textContent = 'Gespeichert';
}

// ── Pflicht-Setup nach der ersten Anmeldung ───────────────
export function openProfileSetupModal(){
  if(hasProfile()) return;
  const p = S.profile || {};
  document.getElementById('psm-firstname').value = p.firstName || '';
  document.getElementById('psm-birthdate').value = p.birthdate || '';
  document.getElementById('psm-height').value = p.heightCm ?? '';
  document.getElementById('psm-weight').value = p.weightKg ?? '';
  document.getElementById('psm-error').textContent = '';
  document.getElementById('profile-setup-modal').classList.add('open');
}
export function saveProfileSetup(){
  const firstName = document.getElementById('psm-firstname').value;
  const birthdate = document.getElementById('psm-birthdate').value;
  const heightCm  = document.getElementById('psm-height').value;
  const weightKg  = document.getElementById('psm-weight').value;
  const errEl = document.getElementById('psm-error');
  const err = validateProfile(firstName, birthdate, heightCm, weightKg);
  if(err){ errEl.textContent = err; return; }
  errEl.textContent = '';
  commitProfile(firstName, birthdate, heightCm, weightKg);
  closeModal('profile-setup-modal');
}
