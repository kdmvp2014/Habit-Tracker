import { renderHeute } from './heute.js';
import { renderTable } from './calendar.js';
import { renderWorkout } from './workout.js';
import { renderTodos } from './todos.js';
import { renderManage } from './habits.js';
import { renderErnaehrung } from './nutrition.js';
import { renderSettings } from './settings.js';

// ── VIEW SWITCH ───────────────────────────────────────────
const VIEW_LABELS = {
  heute:'Heute', monat:'Monatsraster', workout:'Workout',
  todos:'To-Dos & Termine', habits:'Habits', ernaehrung:'Ernährung', settings:'Einstellungen'
};

export function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  const sideNav = document.getElementById('nav-'+name);
  if(sideNav) sideNav.classList.add('active');
  const bNav = document.getElementById('bnav-'+name);
  if(bNav) bNav.classList.add('active');
  // Update mobile header title
  const mht = document.getElementById('mobile-header-title');
  if(mht) mht.textContent = VIEW_LABELS[name]||name;
  // Scroll to top
  document.querySelector('.main').scrollTop = 0;
  if(name==='heute')      renderHeute();
  if(name==='monat')      renderTable();
  if(name==='workout')    renderWorkout();
  if(name==='todos')      renderTodos();
  if(name==='habits')     renderManage();
  if(name==='ernaehrung') renderErnaehrung();
  if(name==='settings')   renderSettings();
}

// ── DESIGN TOGGLE (Dark/Light, app-weit), Präferenz in ht3_theme ──────────
export function toggleDsTheme(){
  const light = document.documentElement.classList.toggle('light');
  localStorage.setItem('ht3_theme', light ? 'light' : 'dark');
  updateDsThemeIcon();
}
export function updateDsThemeIcon(){
  const btn = document.getElementById('ds-theme-btn');
  if(btn) btn.textContent = document.documentElement.classList.contains('light') ? '☀️ Light' : '🌙 Dark';
}
