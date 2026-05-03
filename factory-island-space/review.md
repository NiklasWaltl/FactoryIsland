---
name: factory-island-review
description: Code-Review und QA für Factory Island. Aktivieren bei PR-Reviews, Architektur-Checks oder Qualitätssicherung.
---

# Factory Island Review-Regeln
Diese Datei definiert verbindliche Regeln für Code-Reviews und Qualitätssicherung in Factory Island.

## Pflichtbasis

`factory-island-space/rules.md` ist vor jedem Review Pflichtbasis. Findings müssen an den dort beschriebenen Architekturgrenzen, Hotspots und Änderungsregeln gemessen werden.

## Review-Checkliste

- [ ] Phaser/React-Grenze eingehalten?
- [ ] Kein `dispatch` in Phaser?
- [ ] `Grid.tsx` als einzige Transform-Quelle für Grid-/World-Interaktion erhalten?
- [ ] Korrekte Inventar-Schicht verwendet: `state.inventory`, `warehouseInventories[id]` oder `network.reservations`?
- [ ] Save-Migration und Normalisierung vorhanden, wenn sich persistentes Schema ändert?
- [ ] Import von kanonischer Quelle, nicht direkt aus `reducer.ts`?
- [ ] Keine neuen Duplikate von Konstanten oder Typen?
- [ ] Tick-Logik robust gegen nicht garantierte Reihenfolge?
- [ ] Drohnen-State zwischen `starterDrone` und `drones[id]` konsistent?
- [ ] UI-Panels enthalten keine Spiellogik, die in Reducer, Selector oder Tick gehört?

## Severity-Levels

| Severity | Bedeutung | Beispiele |
|---|---|---|
| breaking | Änderung bricht Architektur, Save-Kompatibilität, Runtime-Verhalten oder zentrale Invarianten. | `dispatch` in Phaser, zweiter World-Root, fehlende Save-Migration, falsche Inventarschicht, Tick-Race mit Datenverlust. |
| non-breaking | Funktionales Risiko ohne unmittelbaren Architekturbruch oder mit begrenztem Scope. | Fehlender Selector, falsche Panel-Auswahl, unvollständige Edge-Case-Behandlung, fehlender Test für neuen Tick-Pfad. |
| style | Lesbarkeit, Konsistenz oder kleine Wartbarkeitsthemen ohne aktuelles Verhaltensrisiko. | Uneinheitliche Benennung, unnötige lokale Duplikation, Formatierung, zu breite Imports. |

## Review-Regeln

- [ ] Findings zuerst nennen, nach Severity sortiert.
- [ ] Bei Architekturbruch immer als `breaking` markieren.
- [ ] Bei Architekturbruch eine konkrete Alternativlösung vorschlagen.
- [ ] Regression gegen eine Dev-Server-Testszene erwähnen, wenn Render, Grid, Placement oder Phaser betroffen sind.
- [ ] `src/game/world/` als Phaser-Baseline für Render-Regressionsprüfung nennen, wenn Phaser-Verhalten betroffen ist.
- [ ] Bei Save- oder Hydration-Änderungen alte Saves als Testfall einfordern.
- [ ] Bei Tick-Änderungen Reihenfolgeunabhängigkeit und Idempotenz prüfen.
- [ ] Bei Inventar-Änderungen physische Bestände und logische Reservierungen getrennt betrachten.

## Review-Ausgabe

- [ ] Jede Finding enthält Severity, betroffenen Pfad und konkrete Auswirkung.
- [ ] Keine reinen Geschmacksfragen als `breaking` markieren.
- [ ] Keine Architekturentscheidung stillschweigend akzeptieren, wenn sie `rules.md` widerspricht.
- [ ] Wenn keine Findings vorhanden sind, verbleibende Testlücken oder Restrisiken kurz benennen.
