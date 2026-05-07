# AGENTS.md — Factory Island

Dieses Dokument richtet sich an KI-Coding-Agenten, die an diesem Repository arbeiten.

Letzte Code-Pruefung: 2026-05-05.

## Projektziel

Factory Island ist ein eigenstaendiges 2D-Fabrik-Aufbauspiel.

## Aktiver Scope

- Arbeite in `src/game/**`, `index.factory.html`, `vite.factory.config.ts`, `tsconfig.factory.json`, `package.json`, `public/` und `.github/workflows/`.

## Verbindliche Read-Order

1. Einstieg: `.continue/prompts/project-context.md` zuerst lesen.
2. Operative Reihenfolge danach: [SYSTEM_REGISTRY.md](SYSTEM_REGISTRY.md) -> [src/game/ARCHITECTURE.md](src/game/ARCHITECTURE.md) -> [src/game/TYPES.md](src/game/TYPES.md) (bei Bedarf).

Nutze dieses Dokument als Verhaltensregeln und verlinke fuer Details auf die obigen Quellen statt Inhalte zu duplizieren.
Bei Arbeiten an Agenten-, Review- oder Doku-Instruktionen zusaetzlich die passende Datei unter `.github/instructions/*.instructions.md` laden.

## Arbeitsmodus

- Bestimme zuerst das owning system und lies danach nur die direkt betroffenen Codepfade.
- Verändere nur die Dateien, die fuer die Aufgabe notwendig sind.
- Arbeite in kleinen, pruefbaren Schritten; bei groesseren Aenderungen erst kurzer Plan mit Risiko.
- Wenn Doku und Code widersprechen, gilt der Code. Markiere die Doku zur Nachpflege.
- Pruefe vor jedem Edit Action-/Tick-/Selector-/Typ-Pfad sowie Save-/Compat-Risiko.

## Architektur- und Boundary-Regeln

- Keine Spiellogik in UI-Komponenten.
- React mutiert State nur via `dispatch`; Phaser ist read-only und dispatcht nicht.
- React Compiler ist aktiv. Render-Purity bleibt Zielzustand: keine neuen nicht-deterministischen Render-Berechnungen (z. B. `Date.now()`/`Math.random()`), keine I/O-Zugriffe und keine mutierenden Singletons im Renderpfad. Bestehende Countdown-UI mit `Date.now()` im Renderpfad gilt als technischer Altstand und sollte bei Beruehrung bevorzugt auf compiler-freundliche Zeitableitung refaktoriert werden.
- Keine neuen Re-Export-Hubs ohne klaren Grund.
- Neue read-only Aggregationen fuer UI oder Drone-Logik als Selector unter `src/game/store/selectors/**` anlegen und direkt von dort importieren; keine neuen Kompatibilitaets-Barrels.
- Produktionsrezepte liegen unter `src/game/simulation/recipes/`. Ausnahme: Module-Lab-Rezepte liegen in `src/game/constants/moduleLabConstants.ts` und werden von `src/game/store/action-handlers/module-lab-actions.ts` und `src/game/ui/panels/ModulLabPanel.tsx` konsumiert.
- Neue UI-Elemente unter `src/game/ui/**`; `BuildMenu.tsx` liegt unter `src/game/ui/menus/`.
- Reine DEV-Tools (Logging, Overlays, Dev-Panels) nur hinter `import.meta.env.DEV` oder `IS_DEV`. Diagnose-UI, die im Release-Build sichtbar sein soll (z. B. Stromnetz-Analyse im BuildMenu), als regulaeres Feature behandeln.

## Build-/Check-Standards

Fuehre nach Aenderungen immer passende Verifikation aus:

- Dev: `yarn dev`
- Build: `yarn build`
- Typecheck: `yarn tsc -p tsconfig.factory.json --noEmit` (lokaler TypeScript-Binary, kein eigenes `package.json`-Script)
- Tests: `yarn test`
- Lint: `yarn lint`

## Bekannte Stolperfallen

- Alte Saves muessen ueber `normalizeLoadedState()` kompatibel bleiben.
- Fuer Footprint-Logik keine nackte `asset.size`-Annahme verwenden. Bevorzugt: zentrale Geometrie-Helper (`assetWidth`/`assetHeight`) oder das etablierte `width`/`height`-Fallback-Muster. Direkte `asset.size`-Nutzung nur in klar begruendeten Infrastrukturpfaden wie Geometrie-Helpern, Rendering, Connectivity, Routing oder Debug/Overlay belassen.
- Rotierbare Maschinen brauchen korrekte `direction`-Logik.
- Das fruehere `starterDrone`-Duplikat wurde per Migration v30 entfernt. Kanonische Laufzeitquelle ist `drones["starter"]`; fuer stabile Reads `selectStarterDrone` oder `requireStarterDrone` nutzen. `syncDrones` ist nur noch ein No-op-Kompatibilitaetshelfer.
- Tick-Dispatches laufen ueber den zentralen BASE_TICK-Orchestrator mit deterministischer Reihenfolge (Generator -> Energy -> Logistics -> Drone -> Job). Tick-Logik trotzdem auf robuste Slice-Interaktionen pruefen.
- Bei Build-Fehlern zuerst Konfigurations- und Importkette pruefen.
- In dieser Windows-Umgebung ist `rg` ggf. nicht verfuegbar; nutze dann VS-Code-Suche oder `Select-String`.

## Guardrails

- Keine neuen npm-Abhaengigkeiten ohne Rueckfrage.
- Keine stillen Fallbacks fuer fehlende Logik.
- Bei jeder neuen persistierten `GameState`-Property muessen zwingend alle drei Pfade gepflegt werden: (1) Default-Wert in `initial-state`, (2) Serialisierung/Deserialisierung im Save-Codec, (3) Migration in `save-migrations.ts` (aktuelle Version: v32). Relevante neuere Schritte: v30 entfernt das legacy-duplicated `starterDrone`-Feld, v31 ergaenzt `unlockedBuildings` fuer Legacy-Saves, v32 ergaenzt `research_lab` idempotent. Zusaetzlich `src/game/store/types.ts` und den Persistenzstatus in `src/game/ARCHITECTURE.md` pruefen. Betrifft u. a.: `moduleInventory`, `moduleFragments`, `moduleLabJob`, `ship`, `splitterRouteState`, `splitterFilterState`, `unlockedBuildings` und den `research_lab`-Unlock-Pfad.
- Keine Aenderung ohne anschliessende Verifikation.
