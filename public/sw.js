const CACHE='habit-tracker-v5';
const ASSETS=['/'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  // Cross-origin Requests (Supabase-API, OpenFoodFacts, USDA, ...) nie cachen —
  // sonst liefert der SW veraltete API-Antworten (z.B. den Datensync-Pull) und
  // Änderungen von anderen Geräten kommen nie an.
  if(new URL(e.request.url).origin!==self.location.origin){
    e.respondWith(fetch(e.request));
    return;
  }
  // Die HTML-Shell (Navigation) immer zuerst vom Netz laden, damit ein neuer
  // Deploy beim nächsten Laden sichtbar ist — nur offline auf den Cache zurückfallen.
  // Gehashte JS/CSS-Dateien bleiben cache-first (Dateiname ändert sich bei Änderungen).
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(res=>{
      if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}
      return res;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}
    return res;
  }).catch(()=>caches.match('/'))));
});
