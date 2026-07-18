import { S } from './state.js';
import { jsDayToPlanIdx } from './date-utils.js';

// ── WORKOUT HELPERS ───────────────────────────────────────
export function getActivePlan(){ return S.plans.find(p=>p.id===S.activePlanId)||null; }
export function todayWorkout(){
  const plan=getActivePlan(); if(!plan) return null;
  const idx=jsDayToPlanIdx(new Date().getDay());
  const day=plan.days[idx];
  return (day && day.exercises && day.exercises.length) ? {name:dayName(idx),exercises:day.exercises} : null;
}
export function dayName(i){return['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'][i];}
