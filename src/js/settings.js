import { S, save, hasProfile } from './state.js';
import { closeModal } from './modal-utils.js';

// ── PROFIL: Vorname, Geburtsdatum, Größe, Gewicht, Geschlecht, Kalorienziel ──
function validateProfile({firstName, birthdate, heightCm, weightKg, gender, calorieGoal}){
  if(!firstName || !firstName.trim()) return 'Bitte Vornamen angeben.';
  if(!birthdate) return 'Bitte Geburtsdatum angeben.';
  if(birthdate > new Date().toISOString().slice(0,10)) return 'Geburtsdatum darf nicht in der Zukunft liegen.';
  const h = parseFloat(heightCm), w = parseFloat(weightKg);
  if(!heightCm || isNaN(h) || h < 50 || h > 250) return 'Größe muss zwischen 50 und 250 cm liegen.';
  if(!weightKg || isNaN(w) || w < 20 || w > 300) return 'Gewicht muss zwischen 20 und 300 kg liegen.';
  if(gender !== 'm' && gender !== 'f') return 'Bitte Geschlecht auswählen.';
  if(calorieGoal){
    const c = parseFloat(calorieGoal);
    if(isNaN(c) || c < 1000 || c > 6000) return 'Kalorienziel muss zwischen 1000 und 6000 kcal liegen.';
  }
  return null;
}
function commitProfile({firstName, birthdate, heightCm, weightKg, gender, calorieGoal}){
  S.profile = {
    firstName: firstName.trim(), birthdate,
    heightCm: parseFloat(heightCm), weightKg: parseFloat(weightKg),
    gender, calorieGoal: calorieGoal ? parseFloat(calorieGoal) : 2500,
  };
  save();
}

// Liest den aktiven Mann/Frau-Toggle innerhalb eines Formulars (id des umschließenden
// Toggle-Containers, z.B. 'settings-gender' oder 'psm-gender').
function readGender(containerId){
  return document.querySelector('#'+containerId+' .filter-pill.active')?.dataset.gender || null;
}
function setGenderUI(containerId, gender){
  document.querySelectorAll('#'+containerId+' .filter-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.gender === gender);
  });
}
// Wird per onclick="setProfileGender(this)" von den Mann/Frau-Pills aufgerufen.
export function setProfileGender(btnEl){
  btnEl.parentElement.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
}

// ── Einstellungen-Ansicht (dauerhaft editierbar) ──────────
export function renderSettings(){
  const p = S.profile || {};
  document.getElementById('settings-firstname').value = p.firstName || '';
  document.getElementById('settings-birthdate').value = p.birthdate || '';
  document.getElementById('settings-height').value = p.heightCm ?? '';
  document.getElementById('settings-weight').value = p.weightKg ?? '';
  document.getElementById('settings-caloriegoal').value = p.calorieGoal ?? 2500;
  setGenderUI('settings-gender', p.gender || null);
  document.getElementById('settings-error').textContent = '';
  document.getElementById('settings-saved').textContent = '';
}
export function saveProfileSettings(){
  const profile = {
    firstName:   document.getElementById('settings-firstname').value,
    birthdate:   document.getElementById('settings-birthdate').value,
    heightCm:    document.getElementById('settings-height').value,
    weightKg:    document.getElementById('settings-weight').value,
    gender:      readGender('settings-gender'),
    calorieGoal: document.getElementById('settings-caloriegoal').value,
  };
  const errEl = document.getElementById('settings-error');
  const err = validateProfile(profile);
  if(err){ errEl.textContent = err; return; }
  errEl.textContent = '';
  commitProfile(profile);
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
  document.getElementById('psm-caloriegoal').value = p.calorieGoal ?? 2500;
  setGenderUI('psm-gender', p.gender || null);
  document.getElementById('psm-error').textContent = '';
  document.getElementById('profile-setup-modal').classList.add('open');
}
export function saveProfileSetup(){
  const profile = {
    firstName:   document.getElementById('psm-firstname').value,
    birthdate:   document.getElementById('psm-birthdate').value,
    heightCm:    document.getElementById('psm-height').value,
    weightKg:    document.getElementById('psm-weight').value,
    gender:      readGender('psm-gender'),
    calorieGoal: document.getElementById('psm-caloriegoal').value,
  };
  const errEl = document.getElementById('psm-error');
  const err = validateProfile(profile);
  if(err){ errEl.textContent = err; return; }
  errEl.textContent = '';
  commitProfile(profile);
  closeModal('profile-setup-modal');
}
