# AGENTS.md — Factory Island

Dieses Dokument richtet sich an KI-Coding-Agenten, die an diesem Repository arbeiten.

## Projektziel

Factory Island ist ein eigenstaendiges 2D-Fabrik-Aufbauspiel.

## Aktiver Scope

- Arbeite in `src/game/**`, `index.factory.html`, `vite.factory.config.ts`, `tsconfig.factory.json`, `package.json`, `public/` und `.github/workflows/`.

## Verbindliche Read-Order

1. `.continue/prompts/project-context.md`
2. [SYSTEM_REGISTRY.md](SYSTEM_REGISTRY.md)
3. [src/game/ARCHITECTURE.md](src/game/ARCHITECTURE.md) nur bei Runtime-/Datenflussfragen
4. [src/game/TYPES.md](src/game/TYPES.md) nur bei Typfragen

Nutze dieses Dokument als Verhaltensregeln und verlinke fuer Details auf die obigen Quellen statt Inhalte zu duplizieren.

## Arbeitsmodus

- Bestimme zuerst das owning system und lies danach nur die direkt betroffenen Codepfade.
- Verändere nur die Dateien, die fuer die Aufgabe notwendig sind.
- Arbeite in kleinen, pruefbaren Schritten; bei groesseren Aenderungen erst kurzer Plan mit Risiko.
- Wenn Doku und Code widersprechen, gilt der Code. Markiere die Doku zur Nachpflege.
- Pruefe vor jedem Edit Action-/Tick-/Selector-/Typ-Pfad sowie Save-/Compat-Risiko.

## Architektur- und Boundary-Regeln

- Keine Spiellogik in UI-Komponenten.
- React mutiert State nur via `dispatch`; Phaser ist read-only und dispatcht nicht.
- Keine neuen Re-Export-Hubs ohne klaren Grund.
- Rezepte nur unter `src/game/simulation/recipes/`.
- Neue UI-Elemente unter `src/game/ui/**`; `BuildMenu.tsx` liegt unter `src/game/ui/menus/`.
- Debug-Code nur hinter `import.meta.env.DEV`.

## Build-/Check-Standards

Fuehre nach Aenderungen immer passende Verifikation aus:

- Dev: `yarn dev`
- Build: `yarn build`
- Typecheck: `yarn tsc -p tsconfig.factory.json --noEmit`
- Tests: `yarn test`
- Lint: `yarn lint`

## Bekannte Stolperfallen

- Alte Saves muessen ueber `normalizeLoadedState()` kompatibel bleiben.
- Bei Groessenberechnungen nie direkt `asset.size` verwenden, sondern vorhandene Helper.
- Rotierbare Maschinen brauchen korrekte `direction`-Logik.
- Bei Build-Fehlern zuerst Konfigurations- und Importkette pruefen.
- In dieser Windows-Umgebung ist `rg` ggf. nicht verfuegbar; nutze dann VS-Code-Suche oder `Select-String`.

## Guardrails

- Keine neuen npm-Abhaengigkeiten ohne Rueckfrage.
- Keine stillen Fallbacks fuer fehlende Logik.
- Keine Aenderung ohne anschliessende Verifikation.