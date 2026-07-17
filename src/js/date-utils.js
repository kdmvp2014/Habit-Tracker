// ── DATE UTILS ────────────────────────────────────────────
export const todayStr = () => fmtDate(new Date());
export function fmtDate(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
export function isoWeek(date){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-ys)/86400000)+1)/7);
}
export function fmtDisp(ds){if(!ds)return'';const[y,m,d]=ds.split('-');return d+'.'+m+'.'+y;}
export function daysUntil(t){const n=new Date();n.setHours(0,0,0,0);const x=new Date(t);x.setHours(0,0,0,0);return Math.round((x-n)/86400000);}
// Convert JS getDay() (0=Sun) to plan day index (0=Mon)
export function jsDayToPlanIdx(jsDay){ return jsDay===0?6:jsDay-1; }
