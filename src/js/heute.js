import { S, currentUser } from './state.js';
import { DOW_L, MONTHS, BIRTHDAY } from './constants.js';
import { todayStr, fmtDisp, daysUntil } from './date-utils.js';
import { todayWorkout } from './workout-helpers.js';
import { isLogged, toggleLog, getStreak } from './log-utils.js';
import { catColor, catLabel, prioLabel } from './label-utils.js';
import { toggleTodoDone } from './todos.js';

// ── HEUTE ─────────────────────────────────────────────────
export function renderHeute(){
  const now=new Date(), ds=todayStr(), hr=now.getHours();
  const g=hr<10?'Guten Morgen':hr<14?'Guten Mittag':'Guten Abend';
  const displayName = (S.profile && S.profile.firstName) || (currentUser && currentUser.email ? currentUser.email.split('@')[0] : '');
  document.getElementById('heute-title').textContent = displayName ? g+', '+displayName+'!' : g+'!';
  document.getElementById('heute-date-sub').textContent=
    DOW_L[now.getDay()]+', '+now.getDate()+'. '+MONTHS[now.getMonth()]+' '+now.getFullYear();

  // Birthday
  const dbd=daysUntil(BIRTHDAY);
  document.getElementById('bday-countdown').textContent=dbd>0?dbd:dbd===0?'Heute!':'';

  // Workout card
  const tw=todayWorkout();
  document.getElementById('heute-workout-name').textContent=tw?tw.name:'Ruhetag';
  document.getElementById('heute-workout-label').textContent=tw?tw.exercises.length+' Übungen':'Kein Training heute';

  // Progress ring
  const total=S.habits.length, done=S.habits.filter(h=>isLogged(h.id,ds)).length;
  const circ=2*Math.PI*20;
  document.getElementById('progress-ring').style.strokeDashoffset=total===0?circ:circ-(done/total)*circ;
  document.getElementById('progress-fraction').textContent=done+'/'+total;

  // Habits list
  const list=document.getElementById('heute-list');
  list.innerHTML='';
  if(total===0){
    list.innerHTML='<div class="empty-state" style="padding:24px 10px"><p>Noch keine Habits.<br>Geh zu <strong>Habits verwalten</strong>.</p></div>';
  } else {
    S.habits.forEach(h=>{
      const checked=isLogged(h.id,ds), streak=getStreak(h.id);
      const wrap=document.createElement('div');
      wrap.className='heute-item'+(checked?' done':'');

      const hdr=document.createElement('div');
      hdr.className='heute-item-header';
      hdr.innerHTML=`
        <div class="heute-cb" style="${checked?`background:${h.color};border-color:transparent;color:#0d0d0f;font-weight:700`:`border-color:${h.color}`}"></div>
        <span class="heute-name">${h.name}</span>
        ${streak>1?`<span class="heute-streak">${streak}</span>`:''}
        ${(h.note||h.freq)?`<span class="heute-expand-btn" onclick="toggleDetail(event,'hd-${h.id}')">Details</span>`:''}`;
      hdr.onclick=ev=>{if(!ev.target.classList.contains('heute-expand-btn')){toggleLog(h.id,ds);renderHeute();}};
      wrap.appendChild(hdr);

      if(h.note||h.freq){
        const det=document.createElement('div');
        det.className='heute-item-detail'; det.id='hd-'+h.id;
        det.innerHTML=`${h.note?`<div style="margin-bottom:6px">${h.note}</div>`:''}
          ${h.freq?`<span class="detail-chip">${h.freq}× / Woche</span>`:''}
          ${catLabel(h.cat)?`<span class="detail-chip">${catLabel(h.cat)}</span>`:''}`;
        wrap.appendChild(det);
      }
      list.appendChild(wrap);
    });
  }

  // Todos
  const tl=document.getElementById('heute-todos-list');
  tl.innerHTML='';
  const open=S.todos.filter(t=>!t.done).sort((a,b)=>{
    if(a.date&&b.date)return a.date.localeCompare(b.date);
    if(a.date)return-1;if(b.date)return 1;
    return{hoch:0,mittel:1,niedrig:2}[a.prio]-{hoch:0,mittel:1,niedrig:2}[b.prio];
  });
  if(open.length===0){
    tl.innerHTML='<div class="empty-state" style="padding:24px 10px"><p>Keine offenen To-Dos!</p></div>';
  } else {
    open.slice(0,8).forEach(t=>{
      const ov=t.date&&t.date<todayStr();
      const d=document.createElement('div');
      d.className='todo-heute-item';
      if(ov)d.style.borderLeft='3px solid var(--red)';
      d.innerHTML=`<div class="todo-cb" style="border-color:${catColor(t.cat)}"></div>
        <div class="todo-body">
          <div class="todo-title">${t.title}</div>
          <div class="todo-meta">
            <span class="todo-tag tag-${t.cat}">${catLabel(t.cat)}</span>
            ${t.date?`<span class="${ov?'overdue-badge':'todo-card-date'}">${fmtDisp(t.date)}</span>`:''}
            <span class="prio-${t.prio}">${prioLabel(t.prio)}</span>
          </div>
        </div>`;
      d.onclick=()=>{toggleTodoDone(t.id);renderHeute();};
      tl.appendChild(d);
    });
    if(open.length>8) tl.innerHTML+=`<div style="font-size:12px;color:var(--text2);text-align:center;padding:8px">+${open.length-8} weitere · <span style="color:var(--accent);cursor:pointer" onclick="showView('todos')">alle anzeigen</span></div>`;
  }
}

export function toggleDetail(ev,id){
  ev.stopPropagation();
  const el=document.getElementById(id); if(!el)return;
  el.classList.toggle('open');
  ev.target.textContent='Details';
}
