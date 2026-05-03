---
name: factory-island-bug
description: Debugging und Fehleranalyse für Factory Island. Aktivieren bei Crashes, Bugs, Tick-Races oder State-Inkonsistenzen.
---

# Factory Island Bug-Regeln
Diese Datei definiert verbindliche Regeln für Debugging, Crashes und Fehleranalyse in Factory Island.

## Pflichtbasis

`factory-island-space/rules.md` ist vor jeder Bug-Analyse Pflichtbasis. Insbesondere müssen Phaser/React-Grenze, `Grid.tsx`-Transform, Inventar-Hierarchie, Tick-Pipeline und Save-Kompatibilität vor einem Fix verstanden sein.

## Fehler-Klassifizierung nach Layer

| Layer | Typische Symptome | Erste Prüfung |
|---|---|---|
| Phaser-Render | Sprite fehlt, falsche Position, Kamera-/Tilemap-Problem, sichtbarer Render-Drift. | `src/game/world/` und Asset-/Sprite-Zuordnung prüfen; kein `dispatch` in Phaser einführen. |
| React-UI | Panel zeigt falsche Daten, Button dispatcht falsche Action, HUD inkonsistent. | Props, Selectors, `openPanel`, `selectedXxxId` und Action-Payload prüfen. |
| Game-Logic | Falsche Produktion, falscher Verbrauch, falsche Placement-Entscheidung. | Reducer-, Action-Handler-, Decision- und Helper-Pfad isolieren. |
| Tick-Race | Sporadische Fehler, nur nach Wartezeit, Reihenfolge schwer reproduzierbar. | Betroffene Ticks und deren State-Schreibfelder vergleichen; Reihenfolge nicht voraussetzen. |
| Save-Hydration | Crash nach Reload, alte Saves defekt, Felder fehlen oder haben falschen Shape. | `normalizeLoadedState()` und Save-Migrations prüfen. |

## Bekannte Fehlerquellen

| Fehlerquelle | Kurzdiagnose | Fix-Richtung |
|---|---|---|
| Drei-Inventar-Mismatch | Stock-Inkonsistenz entsteht, wenn `state.inventory`, `warehouseInventories[id]` und `network.reservations` verwechselt werden. | Physische Quelle bestimmen und Reservierung nur als logischen Hold behandeln. |
| `starterDrone` ↔ `drones[id]` ohne `syncDrones()` | State-Drift entsteht, wenn nur eine Drohnenquelle aktualisiert wird. | Kanonische Drohnen-Helper nutzen und beide Repräsentationen synchron halten. |
| Schema-Änderung ohne Save-Migration | Hydration-Fehler entstehen, weil alte Saves neue Felder oder Shapes nicht enthalten. | Migration und Normalisierung für alte Daten ergänzen. |
| Tick-Race | Reihenfolge ist nicht garantiert; Logik bricht, wenn sie einen bestimmten Tick-Ablauf erwartet. | Tick-Funktionen kommutativ genug machen oder explizite State-Gates nutzen. |
| Energy-Konsumenten-Priorität falsch | `machinePowerRatio` wird falsch, wenn Verbraucher in falscher Reihenfolge Energie erhalten. | Prioritätslogik in `src/game/power/energy-priority.ts` und Energy-Tick prüfen. |

## Pflichtangaben bei Bugreport

- [ ] Layer benennen: Phaser-Render, React-UI, Game-Logic, Tick-Race oder Save-Hydration.
- [ ] Reproduktionsschritte knapp und vollständig beschreiben.
- [ ] Erwartetes Verhalten und tatsächliches Verhalten trennen.
- [ ] Betroffene State-Felder nennen, z. B. `inventory`, `warehouseInventories`, `network.reservations`, `drones`, `starterDrone`, `machinePowerRatio`.
- [ ] Betroffene Action-, Tick-, Selector- oder Render-Pfade nennen, falls bekannt.
- [ ] Commit-Hash angeben, wenn der Fehler regressionsverdächtig oder branch-spezifisch ist.

## Debugging-Regeln

- [ ] Vor einem Fix immer betroffenen Layer und Hotspot identifizieren.
- [ ] Reproduktion zuerst auf die kleinste betroffene Szene oder State-Konstellation reduzieren.
- [ ] Kein stiller Fallback für fehlende Logik; Fehlerursache sichtbar machen und am Ursprung beheben.
- [ ] Bei sporadischen Fehlern Tick-Reihenfolge, Idempotenz und mehrfaches Ausführen derselben Logik prüfen.
- [ ] Bei Hydration-Fehlern alte Saves als Kompatibilitätsfall behandeln, nicht nur den aktuellen Initial-State fixen.
- [ ] Nach dem Fix gezielt den betroffenen Layer verifizieren.
