Factory Island ist ein eigenstaendiges 2D-Fabrik-Aufbauspiel auf React + TypeScript + Phaser.
Letzte Code-Pruefung: 2026-05-07.
Bei Save-/Unlock-Aenderungen immer Initial-State, Save-Codec
und save-migrations gemeinsam pruefen.
Runtime und Spielzustand laufen ueber einen zentralen GameState/Reducer; Phaser rendert nur Snapshots.
Wichtige Kernmechanik - Research/Unlock-System:
Gebaeudefreischaltung laeuft ueber RESEARCH_BUILDING und das Feld
unlockedBuildings im GameState. Placement-Gate: place-building blockiert
Gebaeude, die nicht in unlockedBuildings enthalten sind; Freischaltungen
wirken direkt auf BuildMenu und Placement-Validierung.
Persistenz: Aktuelle Save-Version ist 32. Migrationen enthalten
Unlock-Backfills (inkl. research_lab) und muessen bei Schema-Aenderungen
fortgeschrieben werden.
ARCHITECTURE.md und TYPES.md sind gegen zentrale Codepfade
abgeglichen; README.md und AGENTS.md koennen hinter dem
aktuellen Save-Stand liegen. Bei Detailfragen gilt der Code.
Reading Order

1. SYSTEM_REGISTRY.md
2. src/game/ARCHITECTURE.md
3. src/game/TYPES.md
4. Dann nur die direkt betroffenen Codepfade.
   Fragen -> Datei

- Systemrouting, Pfade, Hotspots, Change-Einstieg -> SYSTEM_REGISTRY.md
- Runtime, Tick-Pipeline, Datenfluss, State-Map, Architekturentscheidungen -> src/game/ARCHITECTURE.md
- Domain-Typen, Typbeziehungen, Konventionen, Checklisten -> src/game/TYPES.md
  Goldene Regeln
- React mutiert State nur via dispatch; GameState ist die zentrale Wahrheit.
- Dispatch-Quellen: Tick-Hooks, UI/Pointer, Keyboard und DEV-Debug-Callbacks.
- Phaser ist read-only und dispatcht nicht.
- Bei Unsicherheit Code vor Doku priorisieren.
- Keine neuen Re-Export-Hubs ohne klaren Grund; bestehende Public-API- und Feature-Index-Barrels sind etablierte Kompatibilitaets- bzw. Aggregationspunkte.
  Aenderungsregeln
- Erst den owning code path lesen, dann klein und lokal aendern.
- Nach Aenderungen gezielt validieren; keine breiten Refactors ohne klaren Anlass.
  Vor dem ersten Edit
- Systemverantwortung, entscheidenden Action-/Tick-/Selector-/Typ-Pfad und Save-/Compat-Risiko pruefen.
