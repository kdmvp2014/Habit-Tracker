// ── LABEL UTILS ───────────────────────────────────────────
export function catLabel(c){return{schule:'Schule',arbeit:'Arbeit',termin:'Termin',privat:'Privat',sonstiges:'Sonstiges',gesundheit:'Gesundheit',lernen:'Lernen',lifestyle:'Lifestyle'}[c]||c;}
export function catColor(c){return{schule:'#60a5fa',arbeit:'#34d399',termin:'#fbbf24',privat:'#a78bfa',sonstiges:'#5a5a6e'}[c]||'#5a5a6e';}
export function prioLabel(p){return{hoch:'Hoch',mittel:'Mittel',niedrig:'Niedrig'}[p]||p;}
export function rgbToHex(rgb){const r=rgb.match(/\d+/g);if(!r)return rgb;return'#'+r.slice(0,3).map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');}
