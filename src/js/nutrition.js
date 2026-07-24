import { S, save, currentUser, sb, USDA_API_KEY } from './state.js';
import { todayStr, fmtDate } from './date-utils.js';
import { DOW_L, MONTHS } from './constants.js';
import { closeModal } from './modal-utils.js';

// ── ERNÄHRUNG ─────────────────────────────────────────────
export const MEALS = ['Frühstück','Mittagessen','Abendessen','Snacks'];

// Goals (clean bulk)
export const GOALS = { kcal: 3700, protein: 180, carbs: 400, fat: 110 };

// Mikronährstoff-Richtwerte nach DACH-Referenzwerten. value = Ziel/Untergrenze
// (bei limitType 'max' zugleich die Obergrenze), ul = harte Obergrenze (null = keine
// bekannte UL). value/ul können entweder eine Zahl (geschlechtsunabhängig) oder
// {m,f} (geschlechtsabhängig) sein. limitType 'min' = Ziel erreichen ist gut (mit
// optionaler UL nach oben), 'max' = reiner Obergrenzen-Nährstoff (Zucker, gesättigte
// Fettsäuren, Cholesterin — "zu wenig" ist hier nicht schlecht).
export const MICRO_GOALS = {
  fiber:       { value:{m:38,f:25},   ul:70,   unit:'g',  label:'Ballaststoffe',          limitType:'min' },
  sugar:       { value:50,            ul:50,   unit:'g',  label:'Zucker',                 limitType:'max' },
  satfat:      { value:22,            ul:24,   unit:'g',  label:'Gesättigte Fettsäuren',  limitType:'max' },
  cholesterol: { value:300,           ul:300,  unit:'mg', label:'Cholesterin',            limitType:'max' },
  omega3:      { value:250,           ul:3000, unit:'mg', label:'Omega-3 (EPA+DHA)',      limitType:'min' },
  sodium:      { value:1500,          ul:2300, unit:'mg', label:'Natrium',                limitType:'min' },
  potassium:   { value:3500,          ul:4700, unit:'mg', label:'Kalium',                 limitType:'min' },
  calcium:     { value:1000,          ul:2500, unit:'mg', label:'Calcium',                limitType:'min' },
  magnesium:   { value:{m:400,f:310}, ul:350,  unit:'mg', label:'Magnesium',              limitType:'min' },
  phosphorus:  { value:700,           ul:4000, unit:'mg', label:'Phosphor',               limitType:'min' },
  iron:        { value:{m:8,f:18},    ul:45,   unit:'mg', label:'Eisen',                  limitType:'min' },
  zinc:        { value:{m:11,f:8},    ul:40,   unit:'mg', label:'Zink',                   limitType:'min' },
  manganese:   { value:{m:2.3,f:1.8}, ul:11,   unit:'mg', label:'Mangan',                 limitType:'min' },
  selenium:    { value:55,            ul:400,  unit:'µg', label:'Selen',                  limitType:'min' },
  copper:      { value:900,           ul:10000,unit:'µg', label:'Kupfer',                 limitType:'min' },
  vitaminC:    { value:{m:90,f:75},   ul:2000, unit:'mg', label:'Vitamin C',              limitType:'min' },
  vitaminB1:   { value:{m:1.2,f:1.1}, ul:null, unit:'mg', label:'Vitamin B1',             limitType:'min' },
  vitaminB2:   { value:{m:1.3,f:1.1}, ul:null, unit:'mg', label:'Vitamin B2',             limitType:'min' },
  vitaminB3:   { value:{m:16,f:14},   ul:35,   unit:'mg', label:'Vitamin B3',             limitType:'min' },
  vitaminB6:   { value:1.3,           ul:100,  unit:'mg', label:'Vitamin B6',             limitType:'min' },
  vitaminB12:  { value:2.4,           ul:null, unit:'µg', label:'Vitamin B12',            limitType:'min' },
  folate:      { value:400,           ul:1000, unit:'µg', label:'Folsäure',               limitType:'min' },
  vitaminA:    { value:{m:900,f:700}, ul:3000, unit:'µg', label:'Vitamin A',              limitType:'min' },
  vitaminD:    { value:15,            ul:100,  unit:'µg', label:'Vitamin D',              limitType:'min' },
  vitaminE:    { value:15,            ul:1000, unit:'mg', label:'Vitamin E',              limitType:'min' },
  vitaminK:    { value:{m:120,f:90},  ul:null, unit:'µg', label:'Vitamin K',              limitType:'min' },
};
export const MICRO_KEYS = Object.keys(MICRO_GOALS);

// Kategorien fürs gruppierte Dashboard im Ernährungs-Tab (je ein eigenes Grid + Titel).
const MICRO_CATEGORIES = [
  { id:'macro',   title:'Ballaststoffe & Zucker', keys:['fiber','sugar'] },
  { id:'fat',     title:'Fette',                  keys:['satfat','cholesterol','omega3'] },
  { id:'mineral', title:'Mineralstoffe',           keys:['sodium','potassium','calcium','magnesium','phosphorus','iron','zinc','manganese','selenium','copper'] },
  { id:'vitamin', title:'Vitamine',                keys:['vitaminC','vitaminB1','vitaminB2','vitaminB3','vitaminB6','vitaminB12','folate','vitaminA','vitaminD','vitaminE','vitaminK'] },
];

// value/ul können geschlechtsabhängig sein ({m,f}) oder ein einzelner Wert.
function goalVal(v, gender){ return (v && typeof v==='object') ? (gender==='f'?v.f:v.m) : v; }

// Ampel-Logik: bei 'max'-Nährstoffen zählt nur die Obergrenze (kein Malus für "zu wenig").
// Bei 'min'-Nährstoffen zählt primär das Ziel, eine optionale UL deckelt nach oben.
function microColor(val, goal, gender){
  const ziel = goalVal(goal.value, gender);
  const ul   = goal.ul!=null ? goalVal(goal.ul, gender) : null;
  if(goal.limitType === 'max'){
    if(val > ul*1.2) return 'var(--red)';
    if(val > ul)     return 'var(--amber)';
    if(val <= ul*0.9) return 'var(--green)';
    return 'var(--amber)'; // 90–100% der Obergrenze
  }
  if(ul!=null && val > ul*1.2) return 'var(--red)';
  if(ul!=null && val > ul)     return 'var(--amber)';
  if(val >= ziel*0.8) return 'var(--green)';
  if(val >= ziel*0.5) return 'var(--amber)';
  return 'var(--red)';
}

export let ernDate = todayStr();
let selectedFoodData = null;
let scannerStream = null;
let searchTimeout = null;
let ernCloudFetchedFor = null;

// Storage key for nutrition
function ernKey(ds){ return 'ern_' + currentUser.id + '_' + ds; }

export function loadErnDay(ds){
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

export function ernChangeDay(delta){
  const d = new Date(ernDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  ernDate = fmtDate(d);
  renderErnaehrung();
}

export function renderErnaehrung(){
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
  const totMicro = {}; MICRO_KEYS.forEach(k => totMicro[k]=0);
  MEALS.forEach(m => {
    (data.meals[m]||[]).forEach(f => {
      totKcal  += f.kcal  ||0;
      totProt  += f.protein||0;
      totCarbs += f.carbs ||0;
      totFat   += f.fat   ||0;
      MICRO_KEYS.forEach(k => totMicro[k] += f[k]||0);
    });
  });

  // Macro cards
  const macros = [
    {label:'Kalorien', val:Math.round(totKcal), unit:'kcal', goal:S.profile.calorieGoal || GOALS.kcal, color:'var(--accent)'},
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

  // Mikronährstoff-Karten: nach Kategorie gruppiert (Makro-Rest/Fette/Mineralstoffe/
  // Vitamine), je ein eigenes Grid. Zielwerte hängen vom Profil-Geschlecht ab.
  const gender = S.profile.gender === 'f' ? 'f' : 'm';
  MICRO_CATEGORIES.forEach(cat => {
    const grid = document.getElementById('micro-grid-'+cat.id);
    if(!grid) return;
    grid.innerHTML = '';
    cat.keys.forEach(k => {
      const goal = MICRO_GOALS[k];
      const val = Math.round(totMicro[k]*10)/10;
      const ziel = goalVal(goal.value, gender);
      const ul = goal.ul!=null ? goalVal(goal.ul, gender) : null;
      const color = microColor(val, goal, gender);
      const barRef = goal.limitType==='max' ? ul : ziel;
      const pct = Math.min(100, Math.round(val/barRef*100));
      const goalText = goal.limitType==='max'
        ? `Max: ${ul}`
        : `Ziel: ${ziel}${ul!=null ? ' · UL '+ul : ''}`;
      const div = document.createElement('div');
      div.className = 'macro-card';
      div.innerHTML = `
        <div class="macro-label">${goal.label}</div>
        <div class="macro-val" style="color:${color}">${val}</div>
        <div class="macro-goal">${goal.unit} · ${goalText}</div>
        <div class="macro-bar-wrap"><div class="macro-bar" style="width:${pct}%;background:${color}"></div></div>`;
      grid.appendChild(div);
    });
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
        <span class="meal-title">${meal}</span>
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
        <button class="food-del" onclick="deleteFoodItem('${meal}',${fi})">Löschen</button>`;
      il.appendChild(div);
    });
  });
}

export function deleteFoodItem(meal, idx){
  const data = loadErnDay(ernDate);
  data.meals[meal].splice(idx, 1);
  saveErnDay(ernDate, data);
  renderErnaehrung();
}

// ── FOOD MODAL ────────────────────────────────────────────
export function openFoodModal(meal){
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
  MICRO_KEYS.forEach(k => { const el = document.getElementById('fm-'+k.toLowerCase()); if(el) el.value=''; });
  document.getElementById('micro-entry').style.display = 'none';
  document.getElementById('fm-save-custom').checked = true;
  document.getElementById('fm-amount').value = '100';
  document.getElementById('fm-unit').value = 'g';
  selectedFoodData = null;
  document.getElementById('food-modal').classList.add('open');
  setTimeout(() => document.getElementById('fm-search').focus(), 80);
}

export function toggleManualEntry(){
  const el = document.getElementById('manual-entry');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

export function toggleMicroEntry(){
  const el = document.getElementById('micro-entry');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── EIGENE LEBENSMITTEL ─────────────────────────────────────
export function upsertCustomFood(food){
  const existing = S.customFoods.find(f => f.name.toLowerCase() === food.name.toLowerCase());
  if(existing){
    Object.assign(existing, food);
  } else {
    S.customFoods.push({ id: Date.now().toString(), ...food });
  }
  save();
}
export function deleteCustomFood(id){
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
    info.innerHTML = `<div class="search-result-name">${f.name}</div>
      <div class="search-result-meta">${f.kcal100} kcal · ${f.protein100}g P · ${f.carbs100}g C · ${f.fat100}g F (pro 100g)</div>`;
    info.onclick = () => selectFood({...f});
    const del = document.createElement('button');
    del.className = 'btn-icon';
    del.textContent = 'Löschen';
    del.title = 'Eigenes Lebensmittel löschen';
    del.style.flexShrink = '0';
    del.onclick = (e) => { e.stopPropagation(); deleteCustomFood(f.id); renderCustomFoodResults(box, q); };
    item.appendChild(info);
    item.appendChild(del);
    box.appendChild(item);
  });
}

// USDA liefert pro Nährwert eine explizite unitName (MG/UG/G) mit — anders als bei
// OpenFoodFacts lässt sich die Einheit hier also sicher statt geraten umrechnen.
// Matching läuft über die numerische FDC-nutrientId statt über nutrientName-Strings,
// da sich Namensvarianten zwischen den Datensätzen (Foundation/SR Legacy/FNDDS)
// unterscheiden können, die nutrientId aber datensatzübergreifend stabil ist.
// Omega-3 hat zwei IDs (EPA+DHA) — mapUsdaNutrients summiert sie.
const USDA_MICRO_MAP = {
  fiber:       { ids:[1079],      unit:'g'  },
  sugar:       { ids:[2000],      unit:'g'  },
  satfat:      { ids:[1258],      unit:'g'  },
  cholesterol: { ids:[1253],      unit:'mg' },
  omega3:      { ids:[1278,1272], unit:'mg' },
  sodium:      { ids:[1093],      unit:'mg' },
  potassium:   { ids:[1092],      unit:'mg' },
  calcium:     { ids:[1087],      unit:'mg' },
  magnesium:   { ids:[1090],      unit:'mg' },
  phosphorus:  { ids:[1091],      unit:'mg' },
  iron:        { ids:[1089],      unit:'mg' },
  zinc:        { ids:[1095],      unit:'mg' },
  manganese:   { ids:[1101],      unit:'mg' },
  selenium:    { ids:[1103],      unit:'µg' },
  copper:      { ids:[1098],      unit:'µg' },
  vitaminC:    { ids:[1162],      unit:'mg' },
  vitaminB1:   { ids:[1165],      unit:'mg' },
  vitaminB2:   { ids:[1166],      unit:'mg' },
  vitaminB3:   { ids:[1167],      unit:'mg' },
  vitaminB6:   { ids:[1175],      unit:'mg' },
  vitaminB12:  { ids:[1178],      unit:'µg' },
  folate:      { ids:[1190],      unit:'µg' },
  vitaminA:    { ids:[1106],      unit:'µg' },
  vitaminD:    { ids:[1114],      unit:'µg' },
  vitaminE:    { ids:[1109],      unit:'mg' },
  vitaminK:    { ids:[1185],      unit:'µg' },
};
function usdaToGrams(value, unitName){
  switch((unitName||'').toUpperCase()){
    case 'MG': return value/1000;
    case 'UG': case 'µG': return value/1e6;
    default:   return value;
  }
}
function gramsToUnit(g, unit){
  if(unit==='mg') return g*1000;
  if(unit==='µg') return g*1e6;
  return g;
}
function mapUsdaNutrients(foodNutrients){
  const list = foodNutrients || [];
  const out = {};
  MICRO_KEYS.forEach(k => {
    const cfg = USDA_MICRO_MAP[k];
    const grams = cfg.ids.reduce((sum, id) => {
      const hit = list.find(n => n.nutrientId === id);
      return sum + (hit ? usdaToGrams(hit.value||0, hit.unitName) : 0);
    }, 0);
    out[k+'100'] = Math.round(gramsToUnit(grams, cfg.unit) * 10)/10;
  });
  return out;
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
    const ql = q.trim().toLowerCase();
    return (d.foods||[]).map(f => {
      // nutrientId 1008 ist gezielt "Energy (kcal)" (getrennt von 1062 "Energy (kJ)"),
      // daher reicht die ID allein ohne zusätzlichen unitName-Check.
      const get = id => (f.foodNutrients||[]).find(n => n.nutrientId===id);
      return {
        name: f.description,
        kcal100:    Math.round(get(1008)?.value || 0),
        protein100: Math.round((get(1003)?.value||0)*10)/10,
        carbs100:   Math.round((get(1005)?.value||0)*10)/10,
        fat100:     Math.round((get(1004)?.value||0)*10)/10,
        ...mapUsdaNutrients(f.foodNutrients),
      };
    }).filter(f => f.kcal100 > 0)
      // Generischer Treffer ("Apple, raw") soll vor Nicht-Kern-Treffern ("Apple juice")
      // stehen — exakte Übereinstimmung zuerst, dann Präfix-Treffer, Rest unverändert.
      .sort((a,b) => {
        const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
        const aEx = an===ql?0:1, bEx = bn===ql?0:1;
        if(aEx!==bEx) return aEx-bEx;
        const aSw = an.startsWith(ql)?0:1, bSw = bn.startsWith(ql)?0:1;
        return aSw-bSw;
      });
  } catch(e){ return []; }
}

// OpenFoodFacts normalisiert nutriments-Werte intern immer auf Gramm (auch bei
// mg/µg-Nährstoffen) — daher die Skalierungsfaktoren. sodium_100g fehlt bei vielen
// Produkten; salt_100g (Salz = Natrium × 2,5) dient dann als Fallback.
const OFF_MICRO_MAP = {
  fiber:       { key:'fiber_100g',         scale:1    },
  sugar:       { key:'sugars_100g',        scale:1    },
  satfat:      { key:'saturated-fat_100g', scale:1    },
  cholesterol: { key:'cholesterol_100g',   scale:1000 },
  omega3:      { key:'omega-3-fat_100g',   scale:1000 },
  sodium:      { key:'sodium_100g',        scale:1000 },
  potassium:   { key:'potassium_100g',     scale:1000 },
  calcium:     { key:'calcium_100g',       scale:1000 },
  magnesium:   { key:'magnesium_100g',     scale:1000 },
  phosphorus:  { key:'phosphorus_100g',    scale:1000 },
  iron:        { key:'iron_100g',          scale:1000 },
  zinc:        { key:'zinc_100g',          scale:1000 },
  manganese:   { key:'manganese_100g',     scale:1000 },
  selenium:    { key:'selenium_100g',      scale:1e6  },
  copper:      { key:'copper_100g',        scale:1e6  },
  vitaminC:    { key:'vitamin-c_100g',     scale:1000 },
  vitaminB1:   { key:'vitamin-b1_100g',    scale:1000 },
  vitaminB2:   { key:'vitamin-b2_100g',    scale:1000 },
  vitaminB3:   { key:'vitamin-pp_100g',    scale:1000 }, // Niacin: OFF-Legacy-Taxonomie
  vitaminB6:   { key:'vitamin-b6_100g',    scale:1000 },
  vitaminB12:  { key:'vitamin-b12_100g',   scale:1e6  },
  folate:      { key:'vitamin-b9_100g',    scale:1e6  },
  vitaminA:    { key:'vitamin-a_100g',     scale:1e6  },
  vitaminD:    { key:'vitamin-d_100g',     scale:1e6  },
  vitaminE:    { key:'vitamin-e_100g',     scale:1000 },
  vitaminK:    { key:'vitamin-k_100g',     scale:1e6  },
};
function mapOffNutriments(n){
  n = n || {};
  const out = {};
  MICRO_KEYS.forEach(k => {
    const m = OFF_MICRO_MAP[k];
    let raw = n[m.key];
    if(raw == null && k==='sodium' && n['salt_100g'] != null) raw = n['salt_100g']/2.5;
    out[k+'100'] = Math.round((raw||0) * m.scale * 10)/10;
  });
  return out;
}

export function searchFood(q){
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
    // USDA-Treffer haben immer höchste Priorität und werden vor den bereits gerenderten
    // eigenen Lebensmitteln eingefügt (statt ans Ende angehängt) — Endreihenfolge:
    // USDA → Eigene Lebensmittel → OpenFoodFacts.
    if(usdaFoods.length){
      const frag = document.createDocumentFragment();
      usdaFoods.forEach(f => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<div class="search-result-name">${f.name} · <span style="color:var(--text2)">USDA, generisch</span></div>
          <div class="search-result-meta">${f.kcal100} kcal · ${f.protein100}g P · ${f.carbs100}g C · ${f.fat100}g F (pro 100g)</div>`;
        item.onclick = () => selectFood(f);
        frag.appendChild(item);
      });
      box.insertBefore(frag, box.firstChild);
    }
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
      item.onclick = () => selectFood({name: p.product_name, kcal100: kcal, protein100: prot, carbs100: carb, fat100: fat, ...mapOffNutriments(n)});
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

export function updateFoodCalc(){
  if(!selectedFoodData) return;
  const amount = parseFloat(document.getElementById('fm-amount').value)||100;
  const unit = document.getElementById('fm-unit').value;
  const factor = (unit==='stk'||unit==='portion') ? 1 : amount/100;
  const kcal = Math.round(selectedFoodData.kcal100 * factor);
  const prot = Math.round(selectedFoodData.protein100 * factor * 10)/10;
  const carb = Math.round(selectedFoodData.carbs100 * factor * 10)/10;
  const fat  = Math.round(selectedFoodData.fat100 * factor * 10)/10;
  document.getElementById('food-calc-preview').textContent =
    `${kcal} kcal · ${prot}g Protein · ${carb}g Carbs · ${fat}g Fett`;
}

// Baut aus den manuellen pro-100g-Feldern ein Food-Objekt, speichert es optional
// dauerhaft und übergibt es an die normale Mengen-/Einheiten-Auswahl.
export function applyManualFood(){
  const name = document.getElementById('fm-manual-name').value.trim();
  if(!name){ document.getElementById('fm-manual-name').focus(); return; }
  const food = {
    name,
    kcal100:    parseFloat(document.getElementById('fm-kcal').value)||0,
    protein100: parseFloat(document.getElementById('fm-protein').value)||0,
    carbs100:   parseFloat(document.getElementById('fm-carbs').value)||0,
    fat100:     parseFloat(document.getElementById('fm-fat').value)||0,
  };
  MICRO_KEYS.forEach(k => {
    const el = document.getElementById('fm-'+k.toLowerCase());
    food[k+'100'] = (el && parseFloat(el.value)) || 0;
  });
  if(document.getElementById('fm-save-custom').checked) upsertCustomFood(food);
  selectFood(food);
  document.getElementById('manual-entry').style.display = 'none';
}

export function saveFood(){
  const meal = document.getElementById('fm-meal').value;
  const data = loadErnDay(ernDate);
  if(!data.meals[meal]) data.meals[meal] = [];

  if(!selectedFoodData){ document.getElementById('fm-search').focus(); return; }

  const amount = parseFloat(document.getElementById('fm-amount').value)||100;
  const unit   = document.getElementById('fm-unit').value;
  const factor = (unit==='stk'||unit==='portion') ? 1 : amount/100;

  const entry = {
    name: selectedFoodData.name,
    amount, unit,
    kcal:    Math.round(selectedFoodData.kcal100 * factor),
    protein: Math.round(selectedFoodData.protein100 * factor * 10)/10,
    carbs:   Math.round(selectedFoodData.carbs100 * factor * 10)/10,
    fat:     Math.round(selectedFoodData.fat100 * factor * 10)/10,
  };
  MICRO_KEYS.forEach(k => {
    entry[k] = Math.round((selectedFoodData[k+'100']||0) * factor * 10)/10;
  });
  data.meals[meal].push(entry);
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

export async function openBarcodeScanner(){
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

export function stopScanner(){
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
        ...mapOffNutriments(n),
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
