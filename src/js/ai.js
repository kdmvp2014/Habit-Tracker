import { loadErnDay, MEALS, GOALS, ernDate } from './nutrition.js';

// ── KI TIPP ───────────────────────────────────────────────
export async function openAiAdvice(){
  const btn = document.getElementById('ai-btn');
  const box = document.getElementById('ai-advice-box');
  const txt = document.getElementById('ai-advice-text');
  btn.textContent = 'Laden...';
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
  btn.textContent = 'KI-Tipp';
  btn.disabled = false;
}
