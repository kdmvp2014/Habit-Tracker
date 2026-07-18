import { S, save } from './state.js';
import { COLORS } from './constants.js';
import { closeModal } from './modal-utils.js';
import { rgbToHex } from './label-utils.js';
import { renderTable } from './calendar.js';
import { renderHeute } from './heute.js';

// ── HABITS ────────────────────────────────────────────────
export function openHabitModal(id){
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
export function saveHabit(){
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
export function editHabit(id){openHabitModal(id);}
export function deleteHabit(id){
  if(!confirm('Habit löschen? Alle Einträge gehen verloren.'))return;
  S.habits=S.habits.filter(h=>h.id!==id);
  save();renderManage();renderHeute();
  if(document.getElementById('view-monat').classList.contains('active'))renderTable();
}

export function renderManage(){
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
