```
# Habit Tracker — CLAUDE.md
```

# `## Projekt` 

```
Persönlicher Produktivitäts-Tracker als Single-File PWA.
Live: https://tracker.jklahn.com
Repo: GitHub Pages (index.html im Root)
```

# `## Stack` 

- `Vanilla HTML/CSS/JavaScript (keine Frameworks)` 

- `Supabase für Auth (E-Mail+Passwort, Bestätigung erforderlich) und geräteübergreifenden Datensync` 

- `Anthropic Claude API (claude-sonnet-4-6) für KI-Features` 

- `OpenFoodFacts API für Lebensmitteldaten` 

# `## Aktuelles Feature-Set` 

- `Heute-Ansicht (Habits, Workout-Card, Geburtstags-Countdown, To-Dos)` 

- `Monatsraster mit ISO-Kalenderwochen` 

- `Workout-Tab (Trainingspläne, Wochenplan, Übungen abhaken)` 

- `To-Dos & Termine (Kategorien, Prioritäten, Fälligkeitsdatum)` 

- `Ernährung (Barcode-Scanner, OpenFoodFacts-Suche, Makro-Dashboard, KI-Tipp)` 

- `Habits verwalten (Name, Farbe, Kategorie, Häufigkeit, Notizen)` 

- `PWA-Support (installierbar, Service Worker, Manifest)` 

- `Mobile Bottom-Navigation (6 Tabs)` 

- `Supabase-Sync (tracker_data + tracker_nutrition Tabellen)` 

# `## Design` 

- `Dunkles Theme (#0d0d0f Hintergrund)` 

- `Akzentfarbe: #7c6aff (Violett)` 

- `Fonts: Syne (Sans) + DM Mono` 

- `Kompass-Stern Logo (lila/indigo Gradient)` 

- `CSS-Variablen für alle Farben` 

# `## Coding-Regeln` 

- `IMMER die komplette index.html ausgeben, nie nur Ausschnitte` 

- `Vor der Ausgabe JS mit node --check validieren (mental)` 

- `Eine Änderung pro Prompt — nicht mehrere Features auf einmal` 

- `Externe Abhängigkeiten: Google Fonts CDN, barcode-detector-Polyfill (jsDelivr, nur bei Bedarf für Browser ohne native Barcode Detection API wie Safari/iOS), @supabase/supabase-js@2 (CDN)` 

- `localStorage-Key-Prefix: ht3_ (habits, logs, todos, plans)` 

- `Ernährungsdaten: ern_YYYY-MM-DD` 

- `Kein hardcodierter User mehr — Zeilen sind pro Account über auth.uid() isoliert (RLS, siehe supabase-setup.sql)` 

- `Supabase-Dashboard: Site URL + Redirect URLs müssen auf https://tracker.jklahn.com (und ggf. localhost für Tests) zeigen, sonst schlägt der E-Mail-Bestätigungslink fehl` 

```
## Wichtige Konstanten im Code
```

- `BIRTHDAY: 15. Dezember 2026 (19. Geburtstag)` 

- `GOALS (Clean Bulk): 3700 kcal / 180g Protein / 400g Carbs / 110g Fett - SUPABASE_URL + SUPABASE_KEY: bereits im Code konfiguriert — nicht überschreiben` 

# `## Deployment` 

`1. index.html auf GitHub hochladen` 

`2. GitHub Pages deployed automatisch nach ~1 Min` 

`3. Cache-Busting: Seite hard-refresh nach Update` 

```
## Was als nächstes geplant ist
```

- `Sommerferien-Lernplan mit KI` 

- `Trainingsplan-Optimierung (Gewichte loggen, Progression)` 

- `Mikronährstoff-Tracking` 

- `Körpergewicht-Tracking` 

