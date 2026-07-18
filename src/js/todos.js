import { S, save } from './state.js';
import { closeModal } from './modal-utils.js';
import { catLabel, catColor, prioLabel } from './label-utils.js';
import { todayStr, fmtDisp } from './date-utils.js';
import { renderHeute } from './heute.js';

let _filter='alle', _catFilter='alle';

// ── TODOS ─────────────────────────────────────────────────
export function setFilter(f,el){_filter=f;document.querySelectorAll('.todo-toolbar .filter-pill:not([id^="cf-"])').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderTodos();}
export function setCatFilter(f,el){_catFilter=f;document.querySelectorAll('[id^="cf-"]').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderTodos();}

export function renderTodos(){
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
  if(!list.length){cont.innerHTML='<div class="empty-state"><p>Keine To-Dos gefunden.</p></div>';return;}
  cont.innerHTML='';
  list.forEach(t=>{
    const ov=!t.done&&t.date&&t.date<todayS;
    const div=document.createElement('div');
    div.className='todo-card'+(t.done?' done-todo':'')+(ov?' overdue':'');
    div.innerHTML=`<div class="todo-cb" style="border-color:${t.done?'var(--green)':catColor(t.cat)};${t.done?'background:var(--green);color:#0d0d0f;font-weight:700':''};cursor:pointer"
      onclick="toggleTodoDone('${t.id}')"></div>
      <div class="todo-card-body">
        <div class="todo-card-title">${t.title}</div>
        ${t.note?`<div style="font-size:12px;color:var(--text2);margin:3px 0 4px">${t.note}</div>`:''}
        <div class="todo-card-meta">
          <span class="todo-tag tag-${t.cat}">${catLabel(t.cat)}</span>
          ${t.date?`<span class="${ov?'overdue-badge':'todo-card-date'}">${ov?'überfällig · ':''}${fmtDisp(t.date)}</span>`:''}
          <span class="prio-${t.prio}">${prioLabel(t.prio)}</span>
        </div>
      </div>
      <div class="todo-card-actions">
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px" onclick="openTodoModal('${t.id}')">Bearbeiten</button>
        <button class="btn btn-danger" style="padding:5px 10px;font-size:12px" onclick="deleteTodo('${t.id}')">Löschen</button>
      </div>`;
    cont.appendChild(div);
  });
}
export function toggleTodoDone(id){const t=S.todos.find(x=>x.id===id);if(t){t.done=!t.done;save();renderTodos();renderHeute();}}
export function deleteTodo(id){if(!confirm('To-Do löschen?'))return;S.todos=S.todos.filter(t=>t.id!==id);save();renderTodos();renderHeute();}

export function openTodoModal(id){
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
export function saveTodo(){
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
