Factory Island ist ein eigenstaendiges 2D-Fabrik-Aufbauspiel auf React + TypeScript + Phaser.
Letzte Code-Pruefung: 2026-05-05.
Runtime und Spielzustand laufen ueber einen zentralen GameState/Reducer; Phaser rendert nur Snapshots. Die verlinkte Kerndoku ist gegen zentrale Codepfade abgeglichen; bei Detailfragen gilt der Code.
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
- Phaser ist read-only und dispatcht nicht.
- Bei Unsicherheit Code vor Doku priorisieren.
- Keine neuen Re-Export-Hubs ohne klaren Grund; bestehende Public-API- und Feature-Index-Barrels sind etablierte Kompatibilitaets- bzw. Aggregationspunkte.
Aenderungsregeln
- Erst den owning code path lesen, dann klein und lokal aendern.
- Nach Aenderungen gezielt validieren; keine breiten Refactors ohne klaren Anlass.
Vor dem ersten Edit
- Systemverantwortung, entscheidenden Action-/Tick-/Selector-/Typ-Pfad und Save-/Compat-Risiko pruefen.