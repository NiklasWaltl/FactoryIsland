---
name: factory-island-feature
description: Feature-Implementierung für Factory Island. Aktivieren bei neuen Buildings, Rezepten, UI-Panels oder Spielmechaniken.
---

# Factory Island Feature-Regeln
Diese Datei definiert verbindliche Regeln für Feature-Implementierungen in Factory Island.

## Pflichtbasis

`factory-island-space/rules.md` ist vor jeder Feature-Implementierung Pflichtbasis. Keine Feature-Änderung darf die dort beschriebenen Grenzen für Phaser, React, `Grid.tsx`, Inventare, Tick-Pipeline oder Save-Kompatibilität umgehen.

## Neues Building

- [ ] Item-ID und Building-Definition anlegen oder erweitern: `src/game/items/registry.ts`, `src/game/items/types.ts` und `src/game/store/constants/buildings/registry.ts` prüfen.
- [ ] `AssetType` erweitern, falls das Building einen neuen Asset-Typ benötigt.
- [ ] Initial-State ergänzen, falls das Building einen eigenen State-Slice braucht.
- [ ] Placement-Validierung in `src/game/grid/placement-validation.ts` und verwandten Building-Helpern prüfen.
- [ ] Tick-Handler nur anlegen, wenn das Building eigenständig verarbeitet, produziert, verbraucht oder periodisch synchronisiert.
- [ ] Sprite/Render im Phaser-Layer ergänzen, ohne State-Mutation in Phaser einzuführen.
- [ ] UI-Panel in `src/game/ui/panels/` oder passendem UI-Pfad ergänzen und nur UI-nahe Aktionen dispatchen.
- [ ] Save-Migration und Normalisierung ergänzen, wenn neue persistente Felder oder neue Shape-Annahmen entstehen.

## Neues Rezept

- [ ] Input- und Output-Items in `src/game/items/registry.ts` und den Item-Typen sicherstellen.
- [ ] Passende Recipe-Datei in `src/game/simulation/recipes/` wählen, z. B. Workbench, Smithy, Manual Assembler oder Auto Assembler.
- [ ] Rezept-Eintrag mit stabiler `id`, `inputs`, `outputs`, Dauer und passendem Workbench-Typ anlegen.
- [ ] Kein Reducer-Code ergänzen, wenn nur ein statisches Rezept registriert wird.
- [ ] Sprite, Display-Name und Stack-Verhalten des Items prüfen.

## Neues UI-Panel

- [ ] Komponente im passenden UI-Pfad anlegen, typischerweise `src/game/ui/panels/`.
- [ ] `UIPanel`-Union um den neuen Panel-Key erweitern.
- [ ] Falls selektionsabhängig, ein passendes `selectedXxxId`-Feld und dessen Reset-Pfade prüfen.
- [ ] Click-Handler oder UI-Trigger ergänzen, der das Panel öffnet.
- [ ] Panel-Routing in der bestehenden UI-Hierarchie ergänzen.
- [ ] Selectors für abgeleitete Read-only-Daten verwenden oder lokal anlegen; UI importiert keine Logik direkt aus `reducer.ts`.

## Implementierungsregeln

- [ ] Vor jeder Implementierung die Phaser/React-Zuständigkeit explizit klären.
- [ ] Bei State-Änderungen den betroffenen Reducer-, Action-, Tick- und Selector-Pfad bestimmen.
- [ ] Änderungen klein und lokal halten, sodass jeder Schritt separat prüfbar bleibt.
- [ ] Keine Spiellogik in UI-Komponenten verschieben.
- [ ] Keine Render-Verantwortung in Reducer- oder Tick-Code einbauen.
- [ ] Keine neuen npm-Abhängigkeiten ohne Rückfrage.
- [ ] Bei Schema-Änderungen Save-Migration als Teil des Features behandeln, nicht als optionalen Nachgang.
