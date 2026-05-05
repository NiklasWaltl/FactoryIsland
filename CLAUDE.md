# CLAUDE.md — Factory Island

Dieses Dokument richtet sich an Claude Code und andere KI-Coding-Agenten, die an diesem Repository arbeiten.
Für allgemeine Agenten-Regeln siehe auch [AGENTS.md](AGENTS.md).

## Projektziel

Factory Island ist ein eigenstaendiges 2D-Fabrik-Aufbauspiel.

## Aktiver Scope

- Arbeite in `src/game/**`, `index.factory.html`, `vite.factory.config.ts`, `tsconfig.factory.json`, `package.json`, `public/` und `.github/workflows/`.

## Verbindliche Read-Order

1. Einstieg: `.continue/prompts/project-context.md` zuerst lesen.
2. Operative Reihenfolge danach: [SYSTEM_REGISTRY.md](SYSTEM_REGISTRY.md) -> [src/game/ARCHITECTURE.md](src/game/ARCHITECTURE.md) -> [src/game/TYPES.md](src/game/TYPES.md) (bei Bedarf).

Nutze dieses Dokument als Verhaltensregeln und verlinke fuer Details auf die obigen Quellen statt Inhalte zu duplizieren.

## Arbeitsmodus

- Bestimme zuerst das owning system und lies danach nur die direkt betroffenen Codepfade.
- Veraendere nur die Dateien, die fuer die Aufgabe notwendig sind.
- Arbeite in kleinen, pruefbaren Schritten; bei groesseren Aenderungen erst kurzer Plan mit Risiko.
- Wenn Doku und Code widersprechen, gilt der Code. Markiere die Doku zur Nachpflege.
- Pruefe vor jedem Edit Action-/Tick-/Selector-/Typ-Pfad sowie Save-/Compat-Risiko.

## Architektur- und Boundary-Regeln

- Keine Spiellogik in UI-Komponenten.
- React mutiert State nur via `dispatch`; Phaser ist read-only und dispatcht nicht.
- Keine neuen Re-Export-Hubs ohne klaren Grund.
- Produktionsrezepte liegen unter `src/game/simulation/recipes/`. Ausnahme: Module-Lab-Rezepte liegen in `src/game/constants/moduleLabConstants.ts` und werden von `src/game/store/action-handlers/module-lab-actions.ts` und `src/game/ui/panels/ModulLabPanel.tsx` konsumiert.
- Neue UI-Elemente unter `src/game/ui/**`; `BuildMenu.tsx` liegt unter `src/game/ui/menus/`.
- Reine DEV-Tools (Logging, Overlays, Dev-Panels) nur hinter `import.meta.env.DEV` oder `IS_DEV`. Diagnose-UI, die im Release-Build sichtbar sein soll (z. B. Stromnetz-Analyse im BuildMenu), als regulaeres Feature behandeln.

## Build-/Check-Standards

Fuehre nach Aenderungen immer passende Verifikation aus:

- Dev: `yarn dev`
- Build: `yarn build`
- Typecheck: `yarn tsc -p tsconfig.factory.json --noEmit`
- Tests: `yarn test`
- Lint: `yarn lint`
- Unter aktuellen Claude-Permissions zusaetzlich erlaubt (Diagnose/Checks): `npx tsc *`, `xargs grep *`, `npx vitest *`.

## Bekannte Stolperfallen

- Alte Saves muessen ueber `normalizeLoadedState()` kompatibel bleiben.
- Fuer Footprint-Logik in der Regel zentrale Geometrie-Helper (`assetWidth`/`assetHeight`) oder das etablierte `width`/`height`-Fallback-Muster nutzen. Direkte `asset.size`-Nutzung vermeiden und nur in klar begruendeten Pfaden (z. B. Rendering, Connectivity, Routing, Debug/Overlay oder bestehende Infrastruktur) belassen; wenn moeglich ueber Helper wie `asset-geometry.ts`.
- Rotierbare Maschinen brauchen korrekte `direction`-Logik.
- Bei Build-Fehlern zuerst Konfigurations- und Importkette pruefen.
- In dieser Windows-Umgebung ist `rg` ggf. nicht verfuegbar; unter aktuellen Claude-Permissions ist `rg` als Bash-Befehl zudem ggf. nicht freigeschaltet. Nutze dann VS-Code-Suche oder `Select-String` sowie erlaubte Alternativen wie `xargs grep *`.

## Guardrails

- Keine neuen npm-Abhaengigkeiten ohne Rueckfrage.
- Keine stillen Fallbacks fuer fehlende Logik.
- Bei jeder neuen persistierten `GameState`-Property muessen zwingend alle drei Pfade gepflegt werden: (1) Default-Wert in `initial-state`, (2) Serialisierung/Deserialisierung im Save-Codec, (3) Migration in `save-migrations.ts` (aktuelle Version: v29). Betrifft u. a.: `moduleInventory`, `moduleFragments`, `moduleLabJob`, `ship`, `splitterRouteState`, `splitterFilterState`.
- Keine Aenderung ohne anschliessende Verifikation.
