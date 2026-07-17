import { createClient } from '@supabase/supabase-js';
import './styles/main.css';


// ── CONSTANTS ─────────────────────────────────────────────
const COLORS   = ['#7c6aff','#34d399','#fbbf24','#f87171','#60a5fa','#f472b6','#a78bfa','#2dd4bf'];
const DOW_S    = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const DOW_L    = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONTHS   = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const BIRTHDAY = new Date(2026,11,15);
// DOW index: 0=So,1=Mo,...,6=Sa  (JS getDay())
// Workout plans use 0=Mo,1=Di,...,6=So  (ISO-style 0-indexed Mon)

// ── STATE ─────────────────────────────────────────────────
let S = {
  habits:  [],  // {id,name,color,cat,note,freq,freqDays}
  logs:    {},  // {"YYYY-MM-DD":{hid:bool}}
  todos:   [],  // {id,title,note,date,cat,prio,done}
  plans:   [],  // {id,name,days:[{exercises:[{name,sets,note,done}]}×7]}  days[0]=Mo
  customFoods: [], // {id,name,kcal100,protein100,carbs100,fat100}
  activePlanId: null,
  viewMonth: null,
  editingHabitId: null,
  editingTodoId:  null,
  selectedColor:  COLORS[0],
  exDay: null,
  exEditIdx: null,
};
let _filter='alle', _catFilter='alle';

// ── AUTH / PERSIST ────────────────────────────────────────
let currentUser = null;   // {id, email} once a session exists
let appStarted  = false;  // guards one-time shell setup from re-running
function nsKey(base){ return currentUser ? base+'_'+currentUser.id : base; }

function load(){
  const tryOld = (key,oldKey) => {
    const v=localStorage.getItem(key); if(v) return JSON.parse(v);
    const o=localStorage.getItem(oldKey); return o?JSON.parse(o):null;
  };
  S.habits = tryOld(nsKey('ht3_habits'),'ht2_habits') || [];
  S.logs   = tryOld(nsKey('ht3_logs'),  'ht2_logs')   || {};
  S.todos  = tryOld(nsKey('ht3_todos'), 'ht2_todos')  || [];
  S.plans  = JSON.parse(localStorage.getItem(nsKey('ht3_plans'))||'[]');
  S.customFoods = JSON.parse(localStorage.getItem(nsKey('ht3_customfoods'))||'[]');
  S.activePlanId = localStorage.getItem(nsKey('ht3_activePlan'))||null;
  if(!S.activePlanId && S.plans.length) S.activePlanId = S.plans[0].id;
}

// ── DATE UTILS ────────────────────────────────────────────
const todayStr = () => fmtDate(new Date());
function fmtDate(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function isoWeek(date){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-ys)/86400000)+1)/7);
}
function fmtDisp(ds){if(!ds)return'';const[y,m,d]=ds.split('-');return d+'.'+m+'.'+y;}
function daysUntil(t){const n=new Date();n.setHours(0,0,0,0);const x=new Date(t);x.setHours(0,0,0,0);return Math.round((x-n)/86400000);}
// Convert JS getDay() (0=Sun) to plan day index (0=Mon)
function jsDayToPlanIdx(jsDay){ return jsDay===0?6:jsDay-1; }

// ── WORKOUT HELPERS ───────────────────────────────────────
function getActivePlan(){ return S.plans.find(p=>p.id===S.activePlanId)||null; }
function todayWorkout(){
  const plan=getActivePlan(); if(!plan) return null;
  const idx=jsDayToPlanIdx(new Date().getDay());
  const day=plan.days[idx];
  return (day && day.exercises && day.exercises.length) ? {name:dayName(idx),exercises:day.exercises} : null;
}
function dayName(i){return['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'][i];}

// ── LOG UTILS ─────────────────────────────────────────────
function isLogged(hid,ds){return!!(S.logs[ds]&&S.logs[ds][hid]);}
function toggleLog(hid,ds){if(!S.logs[ds])S.logs[ds]={};S.logs[ds][hid]=!S.logs[ds][hid];save();}
function getStreak(hid){let n=0;const d=new Date();while(true){if(isLogged(hid,fmtDate(d)))n++;else break;d.setDate(d.getDate()-1);}return n;}

// ── VIEW SWITCH ───────────────────────────────────────────
const VIEW_LABELS = {
  heute:'Heute', monat:'Monatsraster', workout:'Workout',
  todos:'To-Dos & Termine', habits:'Habits', ernaehrung:'Ernährung'
};

function showView(name){
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
}

// ── DESIGN TOGGLE (Dark/Light, app-weit), Präferenz in ht3_theme ──────────
function toggleDsTheme(){
  const light = document.documentElement.classList.toggle('light');
  localStorage.setItem('ht3_theme', light ? 'light' : 'dark');
  updateDsThemeIcon();
}
function updateDsThemeIcon(){
  const btn = document.getElementById('ds-theme-btn');
  if(btn) btn.textContent = document.documentElement.classList.contains('light') ? '☀️ Light' : '🌙 Dark';
}

// ── HEUTE ─────────────────────────────────────────────────
function renderHeute(){
  const now=new Date(), ds=todayStr(), hr=now.getHours();
  const g=hr<10?'Guten Morgen':hr<14?'Guten Mittag':'Guten Abend';
  const displayName = currentUser && currentUser.email ? currentUser.email.split('@')[0] : '';
  document.getElementById('heute-title').textContent = displayName ? g+', '+displayName+'!' : g+'!';
  document.getElementById('heute-date-sub').textContent=
    DOW_L[now.getDay()]+', '+now.getDate()+'. '+MONTHS[now.getMonth()]+' '+now.getFullYear();

  // Birthday
  const dbd=daysUntil(BIRTHDAY);
  document.getElementById('bday-countdown').textContent=dbd>0?dbd:dbd===0?'🎉 Heute!':'✓';

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
    list.innerHTML='<div class="empty-state" style="padding:24px 10px"><div class="empty-icon">◎</div><p>Noch keine Habits.<br>Geh zu <strong>Habits verwalten</strong>.</p></div>';
  } else {
    S.habits.forEach(h=>{
      const checked=isLogged(h.id,ds), streak=getStreak(h.id);
      const wrap=document.createElement('div');
      wrap.className='heute-item'+(checked?' done':'');

      const hdr=document.createElement('div');
      hdr.className='heute-item-header';
      hdr.innerHTML=`
        <div class="heute-cb" style="${checked?`background:${h.color};border-color:transparent;color:#0d0d0f;font-weight:700`:`border-color:${h.color}`}">${checked?'✓':''}</div>
        <span class="heute-name">${h.name}</span>
        ${streak>1?`<span class="heute-streak">🔥 ${streak}</span>`:''}
        ${(h.note||h.freq)?`<span class="heute-expand-btn" onclick="toggleDetail(event,'hd-${h.id}')">▾ Details</span>`:''}`;
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
    tl.innerHTML='<div class="empty-state" style="padding:24px 10px"><div class="empty-icon">✓</div><p>Keine offenen To-Dos!</p></div>';
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
            ${t.date?`<span class="${ov?'overdue-badge':'todo-card-date'}">${ov?'⚠ ':''}${fmtDisp(t.date)}</span>`:''}
            <span class="prio-${t.prio}">${prioLabel(t.prio)}</span>
          </div>
        </div>`;
      d.onclick=()=>{toggleTodoDone(t.id);renderHeute();};
      tl.appendChild(d);
    });
    if(open.length>8) tl.innerHTML+=`<div style="font-size:12px;color:var(--text2);text-align:center;padding:8px">+${open.length-8} weitere → <span style="color:var(--accent);cursor:pointer" onclick="showView('todos')">alle anzeigen</span></div>`;
  }
}

function toggleDetail(ev,id){
  ev.stopPropagation();
  const el=document.getElementById(id); if(!el)return;
  el.classList.toggle('open');
  ev.target.textContent=el.classList.contains('open')?'▴ Details':'▾ Details';
}

// ── MONATSRASTER ──────────────────────────────────────────
function renderTable(){
  const vm=S.viewMonth, year=vm.getFullYear(), month=vm.getMonth();
  const dim=new Date(year,month+1,0).getDate(), todayS=todayStr();
  document.getElementById('month-label').textContent=MONTHS[month]+' '+year;

  const table=document.getElementById('habit-table');
  table.innerHTML='';
  const thead=document.createElement('thead');

  // KW row
  const wRow=document.createElement('tr');
  const wName=document.createElement('th'); wName.className='habit-name-col'; wName.textContent='Habits';
  wRow.appendChild(wName);
  let curW=null,span=0; const wg=[];
  for(let d=1;d<=dim;d++){
    const kw=isoWeek(new Date(year,month,d));
    if(kw!==curW){if(curW!==null)wg.push({kw:curW,span});curW=kw;span=1;}else span++;
    if(d===dim)wg.push({kw:curW,span});
  }
  wg.forEach((g,i)=>{
    const th=document.createElement('th'); th.colSpan=g.span; th.className='week-header';
    th.style.background=i%2===0?'rgba(124,106,255,.06)':'rgba(124,106,255,.03)';
    th.textContent='KW '+g.kw; wRow.appendChild(th);
  });
  thead.appendChild(wRow);

  // Day numbers
  const dRow=document.createElement('tr');
  const dName=document.createElement('th'); dName.className='habit-name-col'; dName.textContent='Tag';
  dRow.appendChild(dName);
  for(let d=1;d<=dim;d++){
    const date=new Date(year,month,d), dow=date.getDay(), ds=fmtDate(date);
    const th=document.createElement('th');
    if(dow===1)th.classList.add('week-sep');
    if(dow===0)th.classList.add('dow-sun');
    if(dow===6)th.classList.add('dow-sat');
    if(ds===todayS)th.style.color='var(--accent)';
    th.textContent=d; dRow.appendChild(th);
  }
  thead.appendChild(dRow);

  // DOW row
  const dowRow=document.createElement('tr');
  const dowName=document.createElement('th'); dowName.className='habit-name-col'; dowName.textContent='';
  dowRow.appendChild(dowName);
  for(let d=1;d<=dim;d++){
    const date=new Date(year,month,d), dow=date.getDay();
    const th=document.createElement('th');
    if(dow===1)th.classList.add('week-sep');
    if(dow===0)th.classList.add('dow-sun');
    if(dow===6)th.classList.add('dow-sat');
    th.textContent=DOW_S[dow]; dowRow.appendChild(th);
  }
  thead.appendChild(dowRow);
  table.appendChild(thead);

  const tbody=document.createElement('tbody');

  // Workout row (if plan active)
  const plan=getActivePlan();
  if(plan){
    const wtr=document.createElement('tr'); wtr.className='workout-table-row';
    const wtd=document.createElement('td'); wtd.className='name-cell';
    wtd.innerHTML='<span style="font-size:10px">🏋️</span> <span>Workout</span>';
    wtr.appendChild(wtd);
    for(let d=1;d<=dim;d++){
      const date=new Date(year,month,d), dow=date.getDay(), ds=fmtDate(date);
      const planIdx=jsDayToPlanIdx(dow);
      const dayPlan=plan.days[planIdx];
      const hasExercises=dayPlan&&dayPlan.exercises&&dayPlan.exercises.length>0;
      const td=document.createElement('td');
      if(dow===1)td.classList.add('week-sep');
      if(ds===todayS)td.classList.add('today-col-td');
      if(hasExercises){
        td.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:42px;cursor:pointer" onclick="showView('workout')" title="${dayName(planIdx)}">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--orange)"></div></div>`;
      }
      wtr.appendChild(td);
    }
    tbody.appendChild(wtr);
  }

  if(S.habits.length===0){
    const tr=document.createElement('tr'); const td=document.createElement('td');
    td.colSpan=dim+1; td.innerHTML='<div class="empty-state" style="padding:32px"><p>Noch keine Habits. Klicke auf <strong>+ Habit</strong>.</p></div>';
    tr.appendChild(td); tbody.appendChild(tr);
  }

  S.habits.forEach(habit=>{
    const tr=document.createElement('tr');
    const nameTd=document.createElement('td'); nameTd.className='name-cell';
    nameTd.innerHTML=`<span class="habit-color-dot" style="background:${habit.color}"></span>${habit.name}`;
    tr.appendChild(nameTd);
    for(let d=1;d<=dim;d++){
      const date=new Date(year,month,d), dow=date.getDay(), ds=fmtDate(date);
      const isFuture=ds>todayS, isToday=ds===todayS, checked=isLogged(habit.id,ds);
      const td=document.createElement('td');
      if(dow===1)td.classList.add('week-sep');
      if(isToday)td.classList.add('today-col-td');
      const wrap=document.createElement('div'); wrap.className='cb-wrap';
      const cb=document.createElement('div');
      cb.className='cb'+(checked?' checked':'')+(isFuture?' future':'');
      cb.style.background=checked?habit.color:'';
      cb.style.borderColor=checked?'transparent':isToday?habit.color:'';
      cb.style.color=checked?'#0d0d0f':'';
      if(checked)cb.textContent='✓';
      if(!isFuture) wrap.onclick=()=>{toggleLog(habit.id,ds);renderTable();if(document.getElementById('view-heute').classList.contains('active'))renderHeute();};
      wrap.appendChild(cb); td.appendChild(wrap); tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  // Stats row
  if(S.habits.length>0){
    const sr=document.createElement('tr'); sr.className='stats-row';
    const st=document.createElement('td'); st.className='name-cell'; st.textContent='Erledigt'; sr.appendChild(st);
    for(let d=1;d<=dim;d++){
      const td=document.createElement('td'); const ds=fmtDate(new Date(year,month,d));
      if(new Date(year,month,d).getDay()===1)td.classList.add('week-sep');
      if(ds>todayS){sr.appendChild(td);continue;}
      const count=S.habits.filter(h=>isLogged(h.id,ds)).length;
      td.textContent=count;
      if(count===S.habits.length&&count>0)td.style.color='var(--green)';
      else if(count===0)td.style.color='var(--red)';
      sr.appendChild(td);
    }
    tbody.appendChild(sr);
  }
  table.appendChild(tbody);
  renderMonthStats(year,month,dim,todayS);
}

function renderMonthStats(year,month,dim,todayS){
  const c=document.getElementById('month-stats'); c.innerHTML='';
  const past=Array.from({length:dim},(_,i)=>fmtDate(new Date(year,month,i+1))).filter(ds=>ds<=todayS).length;
  S.habits.forEach(h=>{
    let done=0;
    for(let d=1;d<=dim;d++){const ds=fmtDate(new Date(year,month,d));if(ds<=todayS&&isLogged(h.id,ds))done++;}
    const pct=past?Math.round(done/past*100):0, streak=getStreak(h.id);
    const div=document.createElement('div'); div.className='month-stat-row';
    div.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:${h.color};flex-shrink:0"></span>
      <span style="flex:1;font-size:13px;font-weight:500">${h.name}</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--text2)">${done}/${past}</span>
      <div style="width:80px;height:5px;background:var(--bg3);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${h.color};border-radius:3px;transition:width .4s"></div></div>
      <span style="font-family:var(--mono);font-size:11px;color:var(--text1);min-width:36px;text-align:right">${pct}%</span>
      ${streak>0?`<span style="font-size:11px;color:var(--amber)">🔥${streak}</span>`:''}`;
    c.appendChild(div);
  });
}

// ── WORKOUT VIEW ──────────────────────────────────────────
function renderWorkout(){
  const plans=S.plans;
  document.getElementById('workout-no-plan').style.display=plans.length?'none':'block';
  document.getElementById('workout-content').style.display=plans.length?'block':'none';
  if(!plans.length)return;

  // Subtitle
  const plan=getActivePlan();
  document.getElementById('workout-subtitle').textContent=plan?plan.name:'Kein Plan aktiv';

  // Plan selector
  const sel=document.getElementById('plan-selector'); sel.innerHTML='';
  plans.forEach(p=>{
    const b=document.createElement('button'); b.className='plan-badge'+(p.id===S.activePlanId?' active':'');
    b.textContent=p.name; b.onclick=()=>{S.activePlanId=p.id;save();renderWorkout();};
    sel.appendChild(b);
  });

  if(!plan)return;

  // Today's workout highlight
  const todayIdx=jsDayToPlanIdx(new Date().getDay());
  const todayDay=plan.days[todayIdx];
  const tws=document.getElementById('today-workout-section'); tws.innerHTML='';
  if(todayDay&&todayDay.exercises&&todayDay.exercises.length){
    const box=document.createElement('div'); box.className='today-workout-big';
    box.innerHTML=`<div class="today-workout-title">🏋️ Heute: ${dayName(todayIdx)} <span style="font-size:12px;font-weight:400;color:var(--text2)">${todayDay.exercises.length} Übungen</span></div>
      <div class="today-ex-grid" id="today-ex-grid"></div>`;
    tws.appendChild(box);
    const grid=box.querySelector('#today-ex-grid');
    todayDay.exercises.forEach((ex,idx)=>{
      const item=document.createElement('div'); item.className='today-ex-item'+(ex.done?' done-ex':'');
      item.innerHTML=`<div class="ex-check${ex.done?' checked-ex':''}" style="border-color:var(--orange);${ex.done?'background:var(--orange);color:#0d0d0f':''}">
        ${ex.done?'✓':''}</div>
        <span class="today-ex-name">${ex.name}</span>
        ${ex.sets?`<span class="today-ex-sets">${ex.sets}</span>`:''}
        ${ex.note?`<span style="font-size:11px;color:var(--text2);font-family:var(--mono)">${ex.note}</span>`:''}`;
      item.onclick=()=>{
        plan.days[todayIdx].exercises[idx].done=!plan.days[todayIdx].exercises[idx].done;
        save();renderWorkout();if(document.getElementById('view-heute').classList.contains('active'))renderHeute();
      };
      grid.appendChild(item);
    });
  }

  // Week grid
  const grid=document.getElementById('week-grid'); grid.innerHTML='';
  for(let i=0;i<7;i++){
    const isToday=i===todayIdx;
    const day=plan.days[i]||{exercises:[]};
    const card=document.createElement('div'); card.className='day-card'+(isToday?' today-day':'');
    const exList=day.exercises||[];
    card.innerHTML=`<div class="day-card-head">
      <span class="day-card-name${isToday?' today-label':''}">${dayName(i).substring(0,2).toUpperCase()}</span>
      <button class="day-add-btn" onclick="openExModal(${i})" title="Übung hinzufügen">+</button>
    </div>
    <div class="exercise-list" id="ex-list-${i}">
      ${exList.length===0?`<div class="rest-day">Ruhetag</div>`:''}
    </div>`;
    grid.appendChild(card);
    if(exList.length){
      const el=card.querySelector('#ex-list-'+i);
      exList.forEach((ex,idx)=>{
        const item=document.createElement('div'); item.className='exercise-item'+(ex.done?' done-ex':'');
        item.innerHTML=`<div class="ex-check${ex.done?' checked-ex':''}" onclick="toggleEx(${i},${idx})" style="${ex.done?'background:var(--orange);border-color:transparent;color:#0d0d0f':''}">${ex.done?'✓':''}</div>
          <span class="ex-name">${ex.name}</span>
          ${ex.sets?`<span class="ex-sets">${ex.sets}</span>`:''}
          <button class="ex-del" onclick="deleteEx(${i},${idx})" title="Löschen">✕</button>`;
        el.appendChild(item);
      });
    }
  }
}

function toggleEx(dayIdx,exIdx){
  const plan=getActivePlan(); if(!plan)return;
  plan.days[dayIdx].exercises[exIdx].done=!plan.days[dayIdx].exercises[exIdx].done;
  save();renderWorkout();
}
function deleteEx(dayIdx,exIdx){
  const plan=getActivePlan(); if(!plan)return;
  plan.days[dayIdx].exercises.splice(exIdx,1);
  save();renderWorkout();
}

// ── PLAN MODAL ────────────────────────────────────────────
function openPlanModal(){
  document.getElementById('pm-name').value='';
  document.getElementById('plan-modal-title').textContent='Neuer Trainingsplan';
  document.getElementById('plan-modal').classList.add('open');
  setTimeout(()=>document.getElementById('pm-name').focus(),80);
}
function savePlan(){
  const name=document.getElementById('pm-name').value.trim();
  if(!name){document.getElementById('pm-name').focus();return;}
  const id=Date.now().toString();
  // days[0]=Mo…days[6]=So, each has exercises:[]
  const days=Array.from({length:7},()=>({exercises:[]}));
  S.plans.push({id,name,days});
  S.activePlanId=id;
  save();closeModal('plan-modal');renderWorkout();
}
function deletePlan(){
  const plan=getActivePlan(); if(!plan)return;
  if(!confirm(`Plan "${plan.name}" wirklich löschen?`))return;
  S.plans=S.plans.filter(p=>p.id!==plan.id);
  S.activePlanId=S.plans.length?S.plans[0].id:null;
  save();renderWorkout();
}
function renamePlan(){
  const plan=getActivePlan(); if(!plan)return;
  const n=prompt('Neuer Name:',plan.name); if(!n||!n.trim())return;
  plan.name=n.trim(); save();renderWorkout();
}

// ── EXERCISE MODAL ────────────────────────────────────────
function openExModal(dayIdx,editIdx){
  S.exDay=dayIdx; S.exEditIdx=editIdx!=null?editIdx:null;
  document.getElementById('ex-modal-title').textContent=editIdx!=null?'Übung bearbeiten':'Übung hinzufügen — '+dayName(dayIdx);
  if(editIdx!=null){
    const ex=getActivePlan().days[dayIdx].exercises[editIdx];
    document.getElementById('em-name').value=ex.name;
    document.getElementById('em-sets').value=ex.sets||'';
    document.getElementById('em-note').value=ex.note||'';
  } else {
    document.getElementById('em-name').value='';
    document.getElementById('em-sets').value='';
    document.getElementById('em-note').value='';
  }
  document.getElementById('exercise-modal').classList.add('open');
  setTimeout(()=>document.getElementById('em-name').focus(),80);
}
function saveExercise(){
  const name=document.getElementById('em-name').value.trim();
  if(!name){document.getElementById('em-name').focus();return;}
  const plan=getActivePlan(); if(!plan)return;
  const ex={name,sets:document.getElementById('em-sets').value.trim(),note:document.getElementById('em-note').value.trim(),done:false};
  if(S.exEditIdx!=null){plan.days[S.exDay].exercises[S.exEditIdx]=ex;}
  else{plan.days[S.exDay].exercises.push(ex);}
  save();closeModal('exercise-modal');renderWorkout();
}

// ── TODOS ─────────────────────────────────────────────────
function setFilter(f,el){_filter=f;document.querySelectorAll('.todo-toolbar .filter-pill:not([id^="cf-"])').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderTodos();}
function setCatFilter(f,el){_catFilter=f;document.querySelectorAll('[id^="cf-"]').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderTodos();}

function renderTodos(){
  const todayS=todayStr();
  let list=[...S.todos];
  if(_filter==='offen')list=list.filter(t=>!t.done);
  if(_filter==='erledigt')list=list.filter(t=>t.done);
  if(_filter==='heute')list=list.filter(t=>!t.done&&t.date===todayS);
  if(_catFilter!=='alle')list=list.filter(t=>t.cat===_catFilter);
  const po={hoch:0,mittel:1,niedrig:2};
  list.sort((a,b)=>{
    if(a.done!==b.done)return a.done?1:-1;
    const aOv=a.date&&a.date<todayS, bOv=b.date&&b.date<todayS;
    if(aOv!==bOv)return aOv?-1:1;
    if(a.date&&b.date)return a.date.localeCompare(b.date);
    if(a.date)return-1;if(b.date)return 1;
    return po[a.prio]-po[b.prio];
  });
  const cont=document.getElementById('todo-list');
  if(!list.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">✦</div><p>Keine To-Dos gefunden.</p></div>';return;}
  cont.innerHTML='';
  list.forEach(t=>{
    const ov=!t.done&&t.date&&t.date<todayS;
    const div=document.createElement('div');
    div.className='todo-card'+(t.done?' done-todo':'')+(ov?' overdue':'');
    div.innerHTML=`<div class="todo-cb" style="border-color:${t.done?'var(--green)':catColor(t.cat)};${t.done?'background:var(--green);color:#0d0d0f;font-weight:700':''};cursor:pointer"
      onclick="toggleTodoDone('${t.id}')">${t.done?'✓':''}</div>
      <div class="todo-card-body">
        <div class="todo-card-title">${t.title}</div>
        ${t.note?`<div style="font-size:12px;color:var(--text2);margin:3px 0 4px">${t.note}</div>`:''}
        <div class="todo-card-meta">
          <span class="todo-tag tag-${t.cat}">${catLabel(t.cat)}</span>
          ${t.date?`<span class="${ov?'overdue-badge':'todo-card-date'}">${ov?'⚠ überfällig · ':''}${fmtDisp(t.date)}</span>`:''}
          <span class="prio-${t.prio}">${prioLabel(t.prio)}</span>
        </div>
      </div>
      <div class="todo-card-actions">
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px" onclick="openTodoModal('${t.id}')">✏</button>
        <button class="btn btn-danger" style="padding:5px 10px;font-size:12px" onclick="deleteTodo('${t.id}')">✕</button>
      </div>`;
    cont.appendChild(div);
  });
}
function toggleTodoDone(id){const t=S.todos.find(x=>x.id===id);if(t){t.done=!t.done;save();renderTodos();renderHeute();}}
function deleteTodo(id){if(!confirm('To-Do löschen?'))return;S.todos=S.todos.filter(t=>t.id!==id);save();renderTodos();renderHeute();}

function openTodoModal(id){
  S.editingTodoId=id||null;
  document.getElementById('todo-modal-title').textContent=id?'To-Do bearbeiten':'Neues To-Do';
  if(id){
    const t=S.todos.find(x=>x.id===id);
    document.getElementById('tm-title').value=t.title;
    document.getElementById('tm-note').value=t.note||'';
    document.getElementById('tm-date').value=t.date||'';
    document.getElementById('tm-cat').value=t.cat;
    document.getElementById('tm-prio').value=t.prio;
  } else {
    ['tm-title','tm-note'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('tm-date').value='';
    document.getElementById('tm-cat').value='schule';
    document.getElementById('tm-prio').value='mittel';
  }
  document.getElementById('todo-modal').classList.add('open');
  setTimeout(()=>document.getElementById('tm-title').focus(),80);
}
function saveTodo(){
  const title=document.getElementById('tm-title').value.trim();
  if(!title){document.getElementById('tm-title').focus();return;}
  const obj={title,note:document.getElementById('tm-note').value.trim(),date:document.getElementById('tm-date').value||'',
    cat:document.getElementById('tm-cat').value,prio:document.getElementById('tm-prio').value,done:false};
  if(S.editingTodoId){
    const idx=S.todos.findIndex(t=>t.id===S.editingTodoId);
    obj.id=S.editingTodoId; obj.done=S.todos[idx].done; S.todos[idx]=obj;
  } else {obj.id=Date.now().toString();S.todos.push(obj);}
  save();closeModal('todo-modal');renderTodos();renderHeute();
}

// ── HABITS ────────────────────────────────────────────────
function openHabitModal(id){
  S.editingHabitId=id||null;
  const picker=document.getElementById('hm-colors'); picker.innerHTML='';
  COLORS.forEach(c=>{
    const sw=document.createElement('div');
    sw.className='color-swatch'+(c===S.selectedColor?' selected':'');
    sw.style.background=c;
    sw.onclick=()=>{S.selectedColor=c;document.querySelectorAll('#hm-colors .color-swatch').forEach(s=>s.classList.remove('selected'));sw.classList.add('selected');};
    picker.appendChild(sw);
  });
  if(id){
    const h=S.habits.find(x=>x.id===id);
    document.getElementById('habit-modal-title').textContent='Habit bearbeiten';
    document.getElementById('hm-name').value=h.name;
    document.getElementById('hm-note').value=h.note||'';
    document.getElementById('hm-cat').value=h.cat;
    document.getElementById('hm-freq').value=h.freq||'7';
    S.selectedColor=h.color;
    document.querySelectorAll('#hm-colors .color-swatch').forEach(s=>s.classList.toggle('selected',rgbToHex(s.style.background)===h.color||s.style.background===h.color));
  } else {
    document.getElementById('habit-modal-title').textContent='Neuen Habit hinzufügen';
    document.getElementById('hm-name').value='';
    document.getElementById('hm-note').value='';
    document.getElementById('hm-cat').value='gesundheit';
    document.getElementById('hm-freq').value='7';
  }
  document.getElementById('habit-modal').classList.add('open');
  setTimeout(()=>document.getElementById('hm-name').focus(),80);
}
function saveHabit(){
  const name=document.getElementById('hm-name').value.trim();
  if(!name){document.getElementById('hm-name').focus();return;}
  const obj={name,note:document.getElementById('hm-note').value.trim(),cat:document.getElementById('hm-cat').value,
    freq:document.getElementById('hm-freq').value,color:S.selectedColor};
  if(S.editingHabitId){Object.assign(S.habits.find(x=>x.id===S.editingHabitId),obj);}
  else{obj.id=Date.now().toString();S.habits.push(obj);S.selectedColor=COLORS[S.habits.length%COLORS.length];}
  save();closeModal('habit-modal');renderHeute();
  if(document.getElementById('view-monat').classList.contains('active'))renderTable();
  if(document.getElementById('view-habits').classList.contains('active'))renderManage();
}
function editHabit(id){openHabitModal(id);}
function deleteHabit(id){
  if(!confirm('Habit löschen? Alle Einträge gehen verloren.'))return;
  S.habits=S.habits.filter(h=>h.id!==id);
  save();renderManage();renderHeute();
  if(document.getElementById('view-monat').classList.contains('active'))renderTable();
}

function renderManage(){
  const list=document.getElementById('habits-manage-list');
  if(!S.habits.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">✦</div><p>Keine Habits. Klicke auf <strong>+ Habit</strong>.</p></div>';return;}
  list.innerHTML='';
  S.habits.forEach(h=>{
    const div=document.createElement('div'); div.className='manage-item';
    div.innerHTML=`<span style="width:10px;height:10px;border-radius:50%;background:${h.color};flex-shrink:0"></span>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:500">${h.name}</div>
        ${h.note?`<div class="manage-item-detail" style="margin-top:2px">${h.note}</div>`:''}
      </div>
      <span style="font-size:11px;color:var(--text2);font-family:var(--mono);flex-shrink:0">${h.freq||7}×/Wo</span>
      <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px" onclick="editHabit('${h.id}')">Bearbeiten</button>
      <button class="btn btn-danger" style="padding:5px 10px;font-size:12px" onclick="deleteHabit('${h.id}')">Löschen</button>`;
    list.appendChild(div);
  });
}

// ── MONTH NAV ─────────────────────────────────────────────
function changeMonth(d){S.viewMonth.setMonth(S.viewMonth.getMonth()+d);renderTable();}
function goToday(){const n=new Date();S.viewMonth=new Date(n.getFullYear(),n.getMonth(),1);renderTable();}

// ── MODAL UTILS ───────────────────────────────────────────
function closeModal(id){document.getElementById(id).classList.remove('open');S.editingHabitId=null;S.editingTodoId=null;}
function handleOverlay(e,id){if(e.target===document.getElementById(id))closeModal(id);}

// ── LABEL UTILS ───────────────────────────────────────────
function catLabel(c){return{schule:'Schule',arbeit:'Arbeit',termin:'Termin',privat:'Privat',sonstiges:'Sonstiges',gesundheit:'Gesundheit',lernen:'Lernen',lifestyle:'Lifestyle'}[c]||c;}
function catColor(c){return{schule:'#60a5fa',arbeit:'#34d399',termin:'#fbbf24',privat:'#a78bfa',sonstiges:'#5a5a6e'}[c]||'#5a5a6e';}
function prioLabel(p){return{hoch:'↑ Hoch',mittel:'→ Mittel',niedrig:'↓ Niedrig'}[p]||p;}
function rgbToHex(rgb){const r=rgb.match(/\d+/g);if(!r)return rgb;return'#'+r.slice(0,3).map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');}

// ── KEYBOARD ──────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')['habit-modal','todo-modal','plan-modal','exercise-modal'].forEach(id=>closeModal(id));
});

// ── SUPABASE AUTH + SYNC ──────────────────────────────────
const SUPABASE_URL = 'https://oneijrohdxyxbamauyei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZWlqcm9oZHh5eGJhbWF1eWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODU0NTYsImV4cCI6MjA5OTc2MTQ1Nn0.gAeE222V3esQC7XYEvQaZJrR4--GD8XIv0eZj4TTtek';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── USDA FOODDATA CENTRAL (generische/rohe Lebensmittel) ────
// Kostenlosen Key holen: https://fdc.nal.usda.gov/api-key-signup/
// Bewusst NICHT hier im Code (öffentliches Repo!) — wird per Button in der App
// einmalig lokal im Browser gespeichert (localStorage), siehe setUsdaApiKey().
const USDA_API_KEY = localStorage.getItem('usda_api_key') || '';

let lastSyncTime      = null;
let syncTimeout       = null;
let pendingResendEmail = null;

async function syncToSupabase(){
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
      updated_at:   new Date().toISOString()
    };
    const { error } = await sb.from('tracker_data').upsert(payload, { onConflict: 'user_id' });
    if(!error){ lastSyncTime = new Date(); updateSyncIndicator(true); }
    else updateSyncIndicator(false);
  } catch(e){ updateSyncIndicator(false); }
}

// Rückgabe: 'ok' (Daten geladen), 'empty' (kein Fehler, nur noch keine Zeile), 'error' (echter Fehler)
async function loadFromSupabase(){
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
function updateSyncIndicator(state){
  const el = document.getElementById('sync-indicator');
  if(!el) return;
  if(state==='pending'){
    el.innerHTML='<span style="color:var(--text2)">⏳ verbinde…</span>';
  } else if(state===true){
    const t = lastSyncTime ? lastSyncTime.toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'}) : '';
    el.innerHTML=`<span style="color:var(--green)">✓ sync ${t}</span>`;
  } else {
    el.innerHTML='<span style="color:var(--amber)">⚠ sync fehler</span>';
  }
}

function save(){
  if(!currentUser) return;
  localStorage.setItem(nsKey('ht3_habits'), JSON.stringify(S.habits));
  localStorage.setItem(nsKey('ht3_logs'),   JSON.stringify(S.logs));
  localStorage.setItem(nsKey('ht3_todos'),  JSON.stringify(S.todos));
  localStorage.setItem(nsKey('ht3_plans'),  JSON.stringify(S.plans));
  localStorage.setItem(nsKey('ht3_customfoods'), JSON.stringify(S.customFoods));
  localStorage.setItem(nsKey('ht3_activePlan'), S.activePlanId||'');
  debouncedSync();
}

// ── AUTH UI ───────────────────────────────────────────────
function showAuthSection(id){
  document.querySelectorAll('#auth-gate .auth-section').forEach(el=>el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showAuthGate(){
  document.getElementById('app-shell').style.display='none';
  document.getElementById('auth-gate').style.display='block';
  showAuthSection('auth-login');
}
function showAppShell(){
  document.getElementById('auth-gate').style.display='none';
  document.getElementById('app-shell').style.display='block';
  const emailEl = document.getElementById('sidebar-user-email');
  if(emailEl && currentUser) emailEl.textContent = currentUser.email;
}
function isUnconfirmedError(msg){ return !!msg && /confirm/i.test(msg); }

async function handleLogin(){
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

async function handleSignup(){
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

async function handleResend(){
  if(!pendingResendEmail) return;
  const { error } = await sb.auth.resend({ type: 'signup', email: pendingResendEmail });
  const errEl = document.getElementById('pending-error');
  if(errEl) errEl.textContent = error ? error.message : 'Link erneut gesendet.';
}

async function handleLogout(){
  await sb.auth.signOut();
  // Reload passiert im SIGNED_OUT-Handler von onAuthStateChange
}

sb.auth.onAuthStateChange((event, session) => {
  if(event === 'SIGNED_OUT'){ location.reload(); return; }
  if(session && session.user){
    currentUser = { id: session.user.id, email: session.user.email };
    showAppShell();
    if(!appStarted){ appStarted = true; initShellOnce(); }
    loadUserData();
  } else {
    showAuthGate();
  }
});


// ── ERNÄHRUNG ─────────────────────────────────────────────
const MEALS = ['Frühstück','Mittagessen','Abendessen','Snacks'];
const MEAL_ICONS = ['☀️','🌤️','🌙','🍎'];

// Goals (clean bulk)
const GOALS = { kcal: 3700, protein: 180, carbs: 400, fat: 110 };

let ernDate = todayStr();
let selectedFoodData = null;
let scannerStream = null;
let searchTimeout = null;
let ernCloudFetchedFor = null;

// Storage key for nutrition
function ernKey(ds){ return 'ern_' + currentUser.id + '_' + ds; }

function loadErnDay(ds){
  const raw = localStorage.getItem(ernKey(ds));
  if(raw) return JSON.parse(raw);
  // default empty structure
  return { meals: { 'Frühstück':[], 'Mittagessen':[], 'Abendessen':[], 'Snacks':[] } };
}
function saveErnDay(ds, data){
  localStorage.setItem(ernKey(ds), JSON.stringify(data));
  syncErnToSupabase(ds, data);
}
async function syncErnToSupabase(ds, data){
  if(!currentUser) return;
  try {
    await sb.from('tracker_nutrition').upsert(
      { user_id: currentUser.id, date: ds, data: JSON.stringify(data) },
      { onConflict: 'user_id,date' }
    );
  } catch(e){}
}
async function loadErnFromSupabase(ds){
  if(!currentUser) return false;
  try {
    const { data, error } = await sb.from('tracker_nutrition').select('*').eq('user_id', currentUser.id).eq('date', ds);
    if(error || !data || !data.length) return false;
    localStorage.setItem(ernKey(ds), data[0].data);
    return true;
  } catch(e){ return false; }
}

function ernChangeDay(delta){
  const d = new Date(ernDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  ernDate = fmtDate(d);
  renderErnaehrung();
}

function renderErnaehrung(){
  const data = loadErnDay(ernDate);
  const dsAtRender = ernDate;
  if(ernCloudFetchedFor !== dsAtRender){
    ernCloudFetchedFor = dsAtRender;
    loadErnFromSupabase(dsAtRender).then(changed=>{
      if(changed && ernDate === dsAtRender) renderErnaehrung();
    });
  }
  const ts = todayStr();
  const isToday = ernDate === ts;
  const d = new Date(ernDate + 'T00:00:00');
  const label = isToday ? 'Heute' :
    ernDate === fmtDate(new Date(new Date().setDate(new Date().getDate()-1))) ? 'Gestern' :
    DOW_L[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()];
  document.getElementById('ern-day-label').textContent = label;

  // Totals
  let totKcal=0, totProt=0, totCarbs=0, totFat=0;
  MEALS.forEach(m => {
    (data.meals[m]||[]).forEach(f => {
      totKcal  += f.kcal  ||0;
      totProt  += f.protein||0;
      totCarbs += f.carbs ||0;
      totFat   += f.fat   ||0;
    });
  });

  // Macro cards
  const macros = [
    {label:'Kalorien', val:Math.round(totKcal), unit:'kcal', goal:GOALS.kcal, color:'var(--accent)'},
    {label:'Protein',  val:Math.round(totProt), unit:'g',    goal:GOALS.protein, color:'var(--green)'},
    {label:'Carbs',    val:Math.round(totCarbs),unit:'g',    goal:GOALS.carbs,   color:'var(--amber)'},
    {label:'Fett',     val:Math.round(totFat),  unit:'g',    goal:GOALS.fat,     color:'var(--orange)'},
  ];
  const mg = document.getElementById('macro-grid');
  mg.innerHTML = '';
  macros.forEach(m => {
    const pct = Math.min(100, Math.round(m.val/m.goal*100));
    const over = m.val > m.goal;
    const div = document.createElement('div');
    div.className = 'macro-card';
    div.innerHTML = `
      <div class="macro-label">${m.label}</div>
      <div class="macro-val" style="color:${over?'var(--red)':m.color}">${m.val}</div>
      <div class="macro-goal">${m.unit} · Ziel: ${m.goal}</div>
      <div class="macro-bar-wrap"><div class="macro-bar" style="width:${pct}%;background:${over?'var(--red)':m.color}"></div></div>`;
    mg.appendChild(div);
  });

  // Meals
  const mc = document.getElementById('meals-container');
  mc.innerHTML = '';
  MEALS.forEach((meal, mi) => {
    const items = data.meals[meal] || [];
    const mKcal = items.reduce((s,f)=>s+(f.kcal||0),0);
    const sec = document.createElement('div');
    sec.className = 'meal-section';
    sec.innerHTML = `
      <div class="meal-header">
        <span class="meal-title">${MEAL_ICONS[mi]} ${meal}</span>
        <span class="meal-kcal">${Math.round(mKcal)} kcal</span>
      </div>
      <div class="meal-items" id="meal-items-${mi}"></div>
      <button class="add-food-btn" onclick="openFoodModal('${meal}')">+ Lebensmittel hinzufügen</button>`;
    mc.appendChild(sec);

    const il = sec.querySelector('#meal-items-'+mi);
    items.forEach((f, fi) => {
      const div = document.createElement('div');
      div.className = 'food-item';
      div.innerHTML = `
        <div class="food-name">${f.name} <span style="font-size:11px;color:var(--text2)">${f.amount}${f.unit||'g'}</span></div>
        <div class="food-macros">${Math.round(f.kcal||0)} kcal<br>${Math.round(f.protein||0)}P · ${Math.round(f.carbs||0)}C · ${Math.round(f.fat||0)}F</div>
        <button class="food-del" onclick="deleteFoodItem('${meal}',${fi})">✕</button>`;
      il.appendChild(div);
    });
  });
}

function deleteFoodItem(meal, idx){
  const data = loadErnDay(ernDate);
  data.meals[meal].splice(idx, 1);
  saveErnDay(ernDate, data);
  renderErnaehrung();
}

// ── FOOD MODAL ────────────────────────────────────────────
function openFoodModal(meal){
  document.getElementById('fm-meal').value = meal || 'Frühstück';
  document.getElementById('food-modal-title').textContent =
    meal ? 'Zu ' + meal + ' hinzufügen' : 'Lebensmittel hinzufügen';
  document.getElementById('fm-search').value = '';
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('selected-food-info').style.display = 'none';
  document.getElementById('manual-entry').style.display = 'none';
  document.getElementById('fm-manual-name').value = '';
  document.getElementById('fm-kcal').value = '';
  document.getElementById('fm-protein').value = '';
  document.getElementById('fm-carbs').value = '';
  document.getElementById('fm-fat').value = '';
  document.getElementById('fm-save-custom').checked = true;
  document.getElementById('fm-amount').value = '100';
  document.getElementById('fm-unit').value = 'g';
  selectedFoodData = null;
  document.getElementById('food-modal').classList.add('open');
  setTimeout(() => document.getElementById('fm-search').focus(), 80);
}

function toggleManualEntry(){
  const el = document.getElementById('manual-entry');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── EIGENE LEBENSMITTEL ─────────────────────────────────────
function upsertCustomFood(food){
  const existing = S.customFoods.find(f => f.name.toLowerCase() === food.name.toLowerCase());
  if(existing){
    Object.assign(existing, food);
  } else {
    S.customFoods.push({ id: Date.now().toString(), ...food });
  }
  save();
}
function deleteCustomFood(id){
  S.customFoods = S.customFoods.filter(f => f.id !== id);
  save();
}

// ── FOOD SEARCH (OpenFoodFacts) ────────────────────────────
function renderCustomFoodResults(box, q){
  box.innerHTML = '';
  const ql = q.toLowerCase();
  S.customFoods.filter(f => f.name.toLowerCase().includes(ql)).forEach(f => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';
    info.innerHTML = `<div class="search-result-name">🧺 ${f.name}</div>
      <div class="search-result-meta">${f.kcal100} kcal · ${f.protein100}g P · ${f.carbs100}g C · ${f.fat100}g F (pro 100g)</div>`;
    info.onclick = () => selectFood({name: f.name, kcal100: f.kcal100, protein100: f.protein100, carbs100: f.carbs100, fat100: f.fat100});
    const del = document.createElement('button');
    del.className = 'btn-icon';
    del.textContent = '✕';
    del.title = 'Eigenes Lebensmittel löschen';
    del.style.flexShrink = '0';
    del.onclick = (e) => { e.stopPropagation(); deleteCustomFood(f.id); renderCustomFoodResults(box, q); };
    item.appendChild(info);
    item.appendChild(del);
    box.appendChild(item);
  });
}

// Key wird bewusst nicht im (öffentlichen) Repo gespeichert, sondern einmalig lokal
// im Browser hinterlegt. Ein Seiten-Reload danach lädt USDA_API_KEY neu aus localStorage.
function setUsdaApiKey(){
  const current = localStorage.getItem('usda_api_key') || '';
  const k = prompt('USDA FoodData Central API-Key eingeben (kostenlos: fdc.nal.usda.gov/api-key-signup):', current);
  if(k === null) return;
  if(k.trim()) localStorage.setItem('usda_api_key', k.trim());
  else localStorage.removeItem('usda_api_key');
  location.reload();
}

// USDA FoodData Central: kuratierte, nicht popularitätsbasierte Datensätze speziell für
// generische/rohe Lebensmittel (z.B. "Banana, raw") — ergänzt OpenFoodFacts, das für sowas
// als Barcode-Scan-Datenbank strukturell schwach ist. Englischsprachig, siehe USDA_API_KEY.
async function searchUsdaFood(q){
  if(!USDA_API_KEY) return [];
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=${USDA_API_KEY}&pageSize=4&dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS)')}`;
    const r = await fetch(url);
    if(!r.ok) return [];
    const d = await r.json();
    return (d.foods||[]).map(f => {
      const get = name => (f.foodNutrients||[]).find(n => n.nutrientName===name && (name!=='Energy' || n.unitName==='KCAL'));
      return {
        name: f.description,
        kcal100:    Math.round(get('Energy')?.value || 0),
        protein100: Math.round((get('Protein')?.value||0)*10)/10,
        carbs100:   Math.round((get('Carbohydrate, by difference')?.value||0)*10)/10,
        fat100:     Math.round((get('Total lipid (fat)')?.value||0)*10)/10,
      };
    }).filter(f => f.kcal100 > 0);
  } catch(e){ return []; }
}

function searchFood(q){
  clearTimeout(searchTimeout);
  const box = document.getElementById('search-results');
  if(!q || q.length < 2){ box.style.display='none'; return; }
  box.style.display = 'block';
  renderCustomFoodResults(box, q);
  searchTimeout = setTimeout(async () => {
    const loading = document.createElement('div');
    loading.id = 'search-loading';
    loading.style.cssText = 'padding:12px;font-size:12px;color:var(--text2);font-family:var(--mono)';
    loading.textContent = 'Suche...';
    box.appendChild(loading);
    // Der OpenFoodFacts-Legacy-Endpoint antwortet öfter mal mit HTTP 503 (temporär
    // überlastet) — bis zu 3 Versuche machen die Suche in der Praxis deutlich zuverlässiger.
    // Größerer Kandidaten-Pool (20 statt 8): OpenFoodFacts ist primär eine Barcode-Scan-
    // Datenbank, einfache/generische Lebensmittel (z.B. eine rohe Banane) haben oft nur
    // sehr wenige Scans und würden bei reiner Popularitäts-Sortierung sonst nie auftauchen.
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&lc=de&tagtype_0=languages&tag_contains_0=contains&tag_0=german&sort_by=unique_scans_n`;
    const fetchOff = async () => {
      let result = null;
      for(let attempt = 1; attempt <= 3 && result === null; attempt++){
        try {
          const r = await fetch(url);
          if(!r.ok) throw new Error('HTTP '+r.status);
          const d = await r.json();
          result = (d.products||[]).filter(p => p.product_name && p.nutriments);
        } catch(e){
          if(attempt < 3) await new Promise(res => setTimeout(res, 700));
        }
      }
      return result;
    };
    const [products, usdaFoods] = await Promise.all([fetchOff(), searchUsdaFood(q)]);
    document.getElementById('search-loading')?.remove();
    usdaFoods.forEach(f => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `<div class="search-result-name">🌱 ${f.name} · <span style="color:var(--text2)">USDA, generisch</span></div>
        <div class="search-result-meta">${f.kcal100} kcal · ${f.protein100}g P · ${f.carbs100}g C · ${f.fat100}g F (pro 100g)</div>`;
      item.onclick = () => selectFood(f);
      box.appendChild(item);
    });
    if(products === null){
      const err = document.createElement('div');
      err.style.cssText = 'padding:12px;font-size:12px;color:var(--red)';
      err.textContent = 'Lebensmittel-Server antwortet gerade nicht. Kurz erneut versuchen oder manuell eingeben.';
      box.appendChild(err);
      return;
    }
    if(!products.length){
      if(!box.children.length){
        box.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text2)">Keine Ergebnisse. Manuell eingeben?</div>';
      }
      return;
    }
    // Namens-Übereinstimmung vor Popularität gewichten: exakte Treffer ("Banane") und
    // Treffer, die mit dem Suchbegriff beginnen ("Bananen..."), zuerst, erst danach nach
    // Sprache und Beliebtheit sortieren. Ohne das gewinnen fast immer verpackte Markenprodukte
    // mit vielen Scans gegen das schlichte, kaum gescannte Grundnahrungsmittel.
    const ql = q.trim().toLowerCase();
    products.sort((a,b) => {
      const an = a.product_name.toLowerCase().trim(), bn = b.product_name.toLowerCase().trim();
      const aEx = an===ql?0:1, bEx = bn===ql?0:1;
      if(aEx!==bEx) return aEx-bEx;
      const aSw = an.startsWith(ql)?0:1, bSw = bn.startsWith(ql)?0:1;
      if(aSw!==bSw) return aSw-bSw;
      const aDe = a.lang==='de'?0:1, bDe = b.lang==='de'?0:1;
      if(aDe!==bDe) return aDe-bDe;
      return (b.unique_scans_n||0) - (a.unique_scans_n||0);
    });
    products.slice(0, 8).forEach(p => {
      const n = p.nutriments;
      const kcal = Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || (n['energy_100g']||0)/4.184 || 0);
      const prot = Math.round((n['proteins_100g']||0)*10)/10;
      const carb = Math.round((n['carbohydrates_100g']||0)*10)/10;
      const fat  = Math.round((n['fat_100g']||0)*10)/10;
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `<div class="search-result-name">${p.product_name}${p.brands?' · <span style="color:var(--text2)">' + p.brands + '</span>':''}</div>
        <div class="search-result-meta">${kcal} kcal · ${prot}g P · ${carb}g C · ${fat}g F (pro 100g)</div>`;
      item.onclick = () => selectFood({name: p.product_name, kcal100: kcal, protein100: prot, carbs100: carb, fat100: fat});
      box.appendChild(item);
    });
  }, 400);
}

function selectFood(food){
  selectedFoodData = food;
  document.getElementById('selected-food-info').style.display = 'block';
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('sel-food-name').textContent = food.name;
  document.getElementById('sel-food-macros').textContent =
    `${food.kcal100} kcal · ${food.protein100}g P · ${food.carbs100}g C · ${food.fat100}g F (pro 100g)`;
  document.getElementById('fm-search').value = food.name;
  updateFoodCalc();
}

function updateFoodCalc(){
  if(!selectedFoodData) return;
  const amount = parseFloat(document.getElementById('fm-amount').value)||100;
  const unit = document.getElementById('fm-unit').value;
  const factor = (unit==='stk'||unit==='portion') ? 1 : amount/100;
  const kcal = Math.round(selectedFoodData.kcal100 * factor);
  const prot = Math.round(selectedFoodData.protein100 * factor * 10)/10;
  const carb = Math.round(selectedFoodData.carbs100 * factor * 10)/10;
  const fat  = Math.round(selectedFoodData.fat100 * factor * 10)/10;
  document.getElementById('food-calc-preview').textContent =
    `→ ${kcal} kcal · ${prot}g Protein · ${carb}g Carbs · ${fat}g Fett`;
}

// Baut aus den manuellen pro-100g-Feldern ein Food-Objekt, speichert es optional
// dauerhaft und übergibt es an die normale Mengen-/Einheiten-Auswahl.
function applyManualFood(){
  const name = document.getElementById('fm-manual-name').value.trim();
  if(!name){ document.getElementById('fm-manual-name').focus(); return; }
  const food = {
    name,
    kcal100:    parseFloat(document.getElementById('fm-kcal').value)||0,
    protein100: parseFloat(document.getElementById('fm-protein').value)||0,
    carbs100:   parseFloat(document.getElementById('fm-carbs').value)||0,
    fat100:     parseFloat(document.getElementById('fm-fat').value)||0,
  };
  if(document.getElementById('fm-save-custom').checked) upsertCustomFood(food);
  selectFood(food);
  document.getElementById('manual-entry').style.display = 'none';
}

function saveFood(){
  const meal = document.getElementById('fm-meal').value;
  const data = loadErnDay(ernDate);
  if(!data.meals[meal]) data.meals[meal] = [];

  if(!selectedFoodData){ document.getElementById('fm-search').focus(); return; }

  const amount = parseFloat(document.getElementById('fm-amount').value)||100;
  const unit   = document.getElementById('fm-unit').value;
  const factor = (unit==='stk'||unit==='portion') ? 1 : amount/100;

  data.meals[meal].push({
    name: selectedFoodData.name,
    amount, unit,
    kcal:    Math.round(selectedFoodData.kcal100 * factor),
    protein: Math.round(selectedFoodData.protein100 * factor * 10)/10,
    carbs:   Math.round(selectedFoodData.carbs100 * factor * 10)/10,
    fat:     Math.round(selectedFoodData.fat100 * factor * 10)/10,
  });
  saveErnDay(ernDate, data);
  closeModal('food-modal');
  renderErnaehrung();
}

// ── BARCODE SCANNER ───────────────────────────────────────
// Safari (iOS) und Firefox haben keine native Barcode Detection API — Polyfill
// (ZXing als WebAssembly) wird nur bei Bedarf nachgeladen, sonst kein Extra-Request.
let _barcodeDetectorPolyfillPromise = null;
function ensureBarcodeDetectorPolyfill(){
  if('BarcodeDetector' in window) return Promise.resolve();
  if(!_barcodeDetectorPolyfillPromise){
    _barcodeDetectorPolyfillPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://fastly.jsdelivr.net/npm/barcode-detector@3/dist/iife/polyfill.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return _barcodeDetectorPolyfillPromise;
}

async function openBarcodeScanner(){
  document.getElementById('scanner-modal').classList.add('open');
  const polyfillReady = ensureBarcodeDetectorPolyfill().catch(() => {});
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const video = document.getElementById('scanner-video');
    video.srcObject = scannerStream;
    document.getElementById('scanner-status').textContent = 'Barcode vor die Kamera halten...';
    await polyfillReady;
    // Use BarcodeDetector if available (nativ oder per Polyfill nachgerüstet)
    if('BarcodeDetector' in window){
      const bd = new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','qr_code']});
      const scan = async () => {
        if(!scannerStream) return;
        try {
          const codes = await bd.detect(video);
          if(codes.length > 0){
            const barcode = codes[0].rawValue;
            stopScanner();
            lookupBarcode(barcode);
            return;
          }
        } catch(e){}
        requestAnimationFrame(scan);
      };
      video.onloadedmetadata = () => scan();
    } else {
      document.getElementById('scanner-status').textContent =
        'Barcode-Erkennung nicht unterstützt. Bitte manuell suchen.';
    }
  } catch(e){
    document.getElementById('scanner-status').textContent = 'Kamera-Zugriff verweigert.';
  }
}

function stopScanner(){
  if(scannerStream){ scannerStream.getTracks().forEach(t=>t.stop()); scannerStream=null; }
  closeModal('scanner-modal');
}

async function lookupBarcode(barcode){
  document.getElementById('fm-search').value = 'Suche Barcode ' + barcode + '...';
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const d = await r.json();
    if(d.status===1 && d.product){
      const p = d.product; const n = p.nutriments;
      const kcal = Math.round(n['energy-kcal_100g']||n['energy-kcal']||(n['energy_100g']||0)/4.184||0);
      selectFood({
        name: p.product_name || 'Unbekanntes Produkt',
        kcal100: kcal,
        protein100: Math.round((n['proteins_100g']||0)*10)/10,
        carbs100:   Math.round((n['carbohydrates_100g']||0)*10)/10,
        fat100:     Math.round((n['fat_100g']||0)*10)/10,
      });
      document.getElementById('food-modal').classList.add('open');
    } else {
      document.getElementById('fm-search').value = '';
      alert('Produkt nicht gefunden. Bitte manuell eingeben.');
    }
  } catch(e){
    document.getElementById('fm-search').value = '';
  }
}

// ── KI TIPP ───────────────────────────────────────────────
async function openAiAdvice(){
  const btn = document.getElementById('ai-btn');
  const box = document.getElementById('ai-advice-box');
  const txt = document.getElementById('ai-advice-text');
  btn.textContent = '⏳ Laden...';
  btn.disabled = true;
  box.style.display = 'block';
  txt.textContent = 'KI analysiert deine heutige Ernährung...';

  const data = loadErnDay(ernDate);
  let totKcal=0, totProt=0, totCarbs=0, totFat=0;
  const allFoods = [];
  MEALS.forEach(m => {
    (data.meals[m]||[]).forEach(f => {
      totKcal  += f.kcal  ||0;
      totProt  += f.protein||0;
      totCarbs += f.carbs ||0;
      totFat   += f.fat   ||0;
      allFoods.push(f.name);
    });
  });

  const prompt = `Du bist ein Ernährungsberater für einen 18-jährigen Gymnasiasten (Jannick) der einen Clean Bulk macht.
Tagesziele: ${GOALS.kcal} kcal, ${GOALS.protein}g Protein, ${GOALS.carbs}g Carbs, ${GOALS.fat}g Fett.
Bisher heute gegessen: ${allFoods.join(', ') || 'noch nichts'}.
Aktuelle Makros: ${Math.round(totKcal)} kcal, ${Math.round(totProt)}g Protein, ${Math.round(totCarbs)}g Carbs, ${Math.round(totFat)}g Fett.
Gib kurze, konkrete Empfehlungen (max 5 Sätze):
1. Was fehlt noch (Makros)?
2. Was sollte er heute noch essen?
3. Was sollte er vermeiden?
Antworte auf Deutsch, direkt und ohne Floskeln.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-6',
        max_tokens:400,
        messages:[{role:'user',content:prompt}]
      })
    });
    const d = await res.json();
    txt.textContent = d.content?.[0]?.text || 'Keine Antwort erhalten.';
  } catch(e){
    txt.textContent = 'Fehler beim Laden der KI-Empfehlung.';
  }
  btn.textContent = '✦ KI-Tipp';
  btn.disabled = false;
}

// ── INIT ─────────────────────────────────────────────────
// Läuft genau einmal pro Seitenaufruf, unabhängig vom Account
async function initShellOnce(){
  updateDsThemeIcon();
  const n=new Date();
  S.viewMonth=new Date(n.getFullYear(),n.getMonth(),1);
  const d=document.getElementById('sidebar-date');
  d.innerHTML=String(n.getDate()).padStart(2,'0')+'.'+String(n.getMonth()+1).padStart(2,'0')+'.'+n.getFullYear()+'<br>'+DOW_S[n.getDay()];
  // Mobile header date
  const mhd=document.getElementById('mobile-header-date');
  if(mhd) mhd.textContent=DOW_S[n.getDay()]+', '+String(n.getDate()).padStart(2,'0')+'.'+String(n.getMonth()+1).padStart(2,'0')+'.';

  // Sync-Indikator in Sidebar anzeigen
  const footer = document.querySelector('.sidebar-footer');
  if(footer){
    const syncEl = document.createElement('div');
    syncEl.id='sync-indicator';
    syncEl.style.cssText='font-family:var(--mono);font-size:10px;margin-top:8px';
    footer.appendChild(syncEl);
  }

  // Service Worker registrieren
  if('serviceWorker' in navigator){
    try {
      // Inline Service Worker als Blob
      const swCode = `
        const CACHE='habit-tracker-v2';
        const ASSETS=[self.location.href.replace('/sw.js','/')];
        self.addEventListener('install',e=>{
          e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
        });
        self.addEventListener('activate',e=>{
          e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
        });
        self.addEventListener('fetch',e=>{
          if(e.request.method!=='GET')return;
          e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
            if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}
            return res;
          }).catch(()=>caches.match('/'))));
        });
      `;
      const blob = new Blob([swCode],{type:'application/javascript'});
      const url  = URL.createObjectURL(blob);
      await navigator.serviceWorker.register(url,{scope:'./'});
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
}

// ── GLOBAL BINDINGS ───────────────────────────────────────
// Vite's module script no longer leaks top-level declarations onto
// `window`, but the rendered HTML still relies on inline onclick="..."
// attribute strings, which are always evaluated against global scope.
// This list was derived by grepping index.html + this file for every
// on(click|change|input|submit|keydown|keyup|error)="name(" occurrence.
window.applyManualFood = applyManualFood;
window.changeMonth = changeMonth;
window.closeModal = closeModal;
window.deleteEx = deleteEx;
window.deleteFoodItem = deleteFoodItem;
window.deleteHabit = deleteHabit;
window.deletePlan = deletePlan;
window.deleteTodo = deleteTodo;
window.editHabit = editHabit;
window.ernChangeDay = ernChangeDay;
window.goToday = goToday;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.handleOverlay = handleOverlay;
window.handleResend = handleResend;
window.handleSignup = handleSignup;
window.openAiAdvice = openAiAdvice;
window.openBarcodeScanner = openBarcodeScanner;
window.openExModal = openExModal;
window.openFoodModal = openFoodModal;
window.openHabitModal = openHabitModal;
window.openPlanModal = openPlanModal;
window.openTodoModal = openTodoModal;
window.renamePlan = renamePlan;
window.saveExercise = saveExercise;
window.saveFood = saveFood;
window.saveHabit = saveHabit;
window.savePlan = savePlan;
window.saveTodo = saveTodo;
window.searchFood = searchFood;
window.setCatFilter = setCatFilter;
window.setFilter = setFilter;
window.setUsdaApiKey = setUsdaApiKey;
window.showAuthSection = showAuthSection;
window.showView = showView;
window.stopScanner = stopScanner;
window.toggleDetail = toggleDetail;
window.toggleDsTheme = toggleDsTheme;
window.toggleEx = toggleEx;
window.toggleManualEntry = toggleManualEntry;
window.toggleTodoDone = toggleTodoDone;
window.updateFoodCalc = updateFoodCalc;
