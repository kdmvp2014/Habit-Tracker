import { S } from './state.js';
import { DOW_S, MONTHS } from './constants.js';
import { fmtDate, isoWeek, todayStr, jsDayToPlanIdx } from './date-utils.js';
import { getActivePlan, dayName } from './workout-helpers.js';
import { isLogged, toggleLog, getStreak } from './log-utils.js';
import { renderHeute } from './heute.js';

// ── MONATSRASTER ──────────────────────────────────────────
export function renderTable(){
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
    wtd.innerHTML='<span>Workout</span>';
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
      ${streak>0?`<span style="font-size:11px;color:var(--amber)">${streak}</span>`:''}`;
    c.appendChild(div);
  });
}

// ── MONTH NAV ─────────────────────────────────────────────
export function changeMonth(d){S.viewMonth.setMonth(S.viewMonth.getMonth()+d);renderTable();}
export function goToday(){const n=new Date();S.viewMonth=new Date(n.getFullYear(),n.getMonth(),1);renderTable();}
