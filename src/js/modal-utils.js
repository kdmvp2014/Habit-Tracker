import { S } from './state.js';

// ── MODAL UTILS ───────────────────────────────────────────
export function closeModal(id){document.getElementById(id).classList.remove('open');S.editingHabitId=null;S.editingTodoId=null;}
export function handleOverlay(e,id){if(e.target===document.getElementById(id))closeModal(id);}

// ── KEYBOARD ──────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')['habit-modal','todo-modal','plan-modal','exercise-modal'].forEach(id=>closeModal(id));
});
