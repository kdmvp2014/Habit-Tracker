import { S, save } from './state.js';
import { getActivePlan, dayName } from './workout-helpers.js';
import { jsDayToPlanIdx } from './date-utils.js';
import { closeModal } from './modal-utils.js';
import { renderHeute } from './heute.js';

// ── WORKOUT VIEW ──────────────────────────────────────────
export function renderWorkout(){
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
    box.innerHTML=`<div class="today-workout-title">Heute: ${dayName(todayIdx)} <span style="font-size:12px;font-weight:400;color:var(--text2)">${todayDay.exercises.length} Übungen</span></div>
      <div class="today-ex-grid" id="today-ex-grid"></div>`;
    tws.appendChild(box);
    const grid=box.querySelector('#today-ex-grid');
    todayDay.exercises.forEach((ex,idx)=>{
      const item=document.createElement('div'); item.className='today-ex-item'+(ex.done?' done-ex':'');
      item.innerHTML=`<div class="ex-check${ex.done?' checked-ex':''}" style="border-color:var(--orange);${ex.done?'background:var(--orange);color:#0d0d0f':''}">
        </div>
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
        item.innerHTML=`<div class="ex-check${ex.done?' checked-ex':''}" onclick="toggleEx(${i},${idx})" style="${ex.done?'background:var(--orange);border-color:transparent;color:#0d0d0f':''}"></div>
          <span class="ex-name">${ex.name}</span>
          ${ex.sets?`<span class="ex-sets">${ex.sets}</span>`:''}
          <button class="ex-del" onclick="deleteEx(${i},${idx})" title="Löschen">Löschen</button>`;
        el.appendChild(item);
      });
    }
  }
}

export function toggleEx(dayIdx,exIdx){
  const plan=getActivePlan(); if(!plan)return;
  plan.days[dayIdx].exercises[exIdx].done=!plan.days[dayIdx].exercises[exIdx].done;
  save();renderWorkout();
}
export function deleteEx(dayIdx,exIdx){
  const plan=getActivePlan(); if(!plan)return;
  plan.days[dayIdx].exercises.splice(exIdx,1);
  save();renderWorkout();
}

// ── PLAN MODAL ────────────────────────────────────────────
export function openPlanModal(){
  document.getElementById('pm-name').value='';
  document.getElementById('plan-modal-title').textContent='Neuer Trainingsplan';
  document.getElementById('plan-modal').classList.add('open');
  setTimeout(()=>document.getElementById('pm-name').focus(),80);
}
export function savePlan(){
  const name=document.getElementById('pm-name').value.trim();
  if(!name){document.getElementById('pm-name').focus();return;}
  const id=Date.now().toString();
  // days[0]=Mo…days[6]=So, each has exercises:[]
  const days=Array.from({length:7},()=>({exercises:[]}));
  S.plans.push({id,name,days});
  S.activePlanId=id;
  save();closeModal('plan-modal');renderWorkout();
}
export function deletePlan(){
  const plan=getActivePlan(); if(!plan)return;
  if(!confirm(`Plan "${plan.name}" wirklich löschen?`))return;
  S.plans=S.plans.filter(p=>p.id!==plan.id);
  S.activePlanId=S.plans.length?S.plans[0].id:null;
  save();renderWorkout();
}
export function renamePlan(){
  const plan=getActivePlan(); if(!plan)return;
  const n=prompt('Neuer Name:',plan.name); if(!n||!n.trim())return;
  plan.name=n.trim(); save();renderWorkout();
}

// ── EXERCISE MODAL ────────────────────────────────────────
export function openExModal(dayIdx,editIdx){
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
export function saveExercise(){
  const name=document.getElementById('em-name').value.trim();
  if(!name){document.getElementById('em-name').focus();return;}
  const plan=getActivePlan(); if(!plan)return;
  const ex={name,sets:document.getElementById('em-sets').value.trim(),note:document.getElementById('em-note').value.trim(),done:false};
  if(S.exEditIdx!=null){plan.days[S.exDay].exercises[S.exEditIdx]=ex;}
  else{plan.days[S.exDay].exercises.push(ex);}
  save();closeModal('exercise-modal');renderWorkout();
}
