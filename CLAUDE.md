# Habit Tracker — CLAUDE.md

## Projekt
Persönlicher Produktivitäts-Tracker als PWA.
Live: https://tracker.jklahn.com
Repo: GitHub Pages via GitHub Actions (Vite-Build aus `main`, siehe `.github/workflows/deploy.yml`)

## Stack
- Vite (Build-Tool) + Vanilla HTML/CSS/JavaScript (keine UI-Frameworks)
- Supabase für Auth (E-Mail+Passwort, Bestätigung erforderlich) und geräteübergreifenden Datensync
- Anthropic Claude API (claude-sonnet-4-6) für KI-Features
- OpenFoodFacts + USDA FoodData Central APIs für Lebensmitteldaten

## Aktuelles Feature-Set
- Heute-Ansicht (Habits, Workout-Card, Geburtstags-Countdown, To-Dos)
- Monatsraster mit ISO-Kalenderwochen
- Workout-Tab (Trainingspläne, Wochenplan, Übungen abhaken)
- To-Dos & Termine (Kategorien, Prioritäten, Fälligkeitsdatum)
- Ernährung (Barcode-Scanner, OpenFoodFacts-Suche, USDA-Suche, Makro-Dashboard, KI-Tipp)
- Habits verwalten (Name, Farbe, Kategorie, Häufigkeit, Notizen)
- PWA-Support (installierbar, Service Worker, Manifest)
- Mobile Bottom-Navigation (6 Tabs), Dark/Light-Theme-Toggle
- Supabase-Sync (`tracker_data` + `tracker_nutrition` Tabellen), pro Account isoliert

## Design
- Dunkles Theme (#0d0d0f Hintergrund), Light-Theme optional
- Akzentfarbe: #7c6aff (Violett)
- Fonts: Syne (Sans) + DM Mono
- Kompass-Stern Logo (lila/indigo Gradient)
- CSS-Variablen für alle Farben

## Projektstruktur
- `index.html` — Vite-Root-Template (Markup + Auth-Gate + App-Shell)
- `src/main.js` — Composition Root (lädt CSS + `global-bindings.js`)
- `src/styles/main.css` — globales Stylesheet
- `src/js/` — ein Modul pro Feature: `constants`, `date-utils`, `label-utils`, `log-utils`, `workout-helpers`, `state` (Persist + Supabase-Sync), `auth`, `nav`, `heute`, `calendar`, `workout`, `todos`, `habits`, `nutrition`, `ai`, `global-bindings`
- `public/` — wird 1:1 nach `dist/` kopiert: `manifest.webmanifest`, `sw.js`, `icons/`, `CNAME`, `.nojekyll`
- `supabase-setup.sql` — SQL zum Einrichten von `tracker_data`/`tracker_nutrition` mit RLS

## Coding-Regeln
- Änderungen im richtigen Modul unter `src/js/` vornehmen, nicht mehr die ganze `index.html` neu ausgeben
- Vor dem Commit: `npm run build` lokal laufen lassen (fängt Modul-/Import-Fehler ab, die im Dev-Server manchmal durchrutschen)
- Eine Änderung pro Prompt — nicht mehrere Features auf einmal
- Neue Funktionen, die per inline `onclick="..."` aus der HTML aufgerufen werden, müssen in `src/js/global-bindings.js` als `window.fn = fn` ergänzt werden — ES-Module leaken nicht automatisch auf `window`
- Externe Abhängigkeiten: Google Fonts CDN, `@supabase/supabase-js` (npm), barcode-detector-Polyfill (jsDelivr, nur bei Bedarf für Browser ohne native Barcode Detection API wie Safari/iOS)
- localStorage-Key-Prefix: `ht3_` (habits, logs, todos, plans, customfoods), jeweils pro Account über `auth.uid()` namespaced (siehe `nsKey()` in `state.js`)
- Ernährungsdaten: `ern_<user-id>_YYYY-MM-DD`
- Kein hardcodierter User — Zeilen sind pro Account über `auth.uid()` isoliert (RLS, siehe `supabase-setup.sql`)
- Supabase-Dashboard: Site URL + Redirect URLs müssen auf `https://tracker.jklahn.com` (und ggf. `localhost` für Tests) zeigen, sonst schlägt der E-Mail-Bestätigungslink fehl

## Wichtige Konstanten im Code
- `BIRTHDAY`: 15. Dezember 2026 (19. Geburtstag)
- `GOALS` (Clean Bulk): 3700 kcal / 180g Protein / 400g Carbs / 110g Fett
- `SUPABASE_URL` + `SUPABASE_KEY`: in `src/js/state.js`, bereits konfiguriert — nicht überschreiben

## Deployment
1. Push nach `main` → GitHub Actions (`.github/workflows/deploy.yml`) baut mit `npm ci && npm run build` und deployed `dist/` automatisch über GitHub Pages
2. Lokal testen: `npm run dev` (Vite Dev-Server) oder `npm run build && npm run preview`
3. Repo-Settings → Pages → Source muss auf **"GitHub Actions"** stehen (nicht "Deploy from a branch")

## Was als nächstes geplant ist
- Sommerferien-Lernplan mit KI
- Trainingsplan-Optimierung (Gewichte loggen, Progression)
- Mikronährstoff-Tracking
- Körpergewicht-Tracking
