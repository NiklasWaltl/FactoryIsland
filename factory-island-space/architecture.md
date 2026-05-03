---
name: factory-island-architecture
description: Architektur-Entscheidungen und Refactoring für Factory Island. Aktivieren bei strukturellen Änderungen, Migrationspfaden oder Systementwürfen.
---

# Factory Island Architektur-Regeln
Diese Datei definiert verbindliche Regeln für Architektur-Entscheidungen und Refactoring in Factory Island.

## Pflichtbasis

`factory-island-space/rules.md` ist vor jeder Architektur-Entscheidung Pflichtbasis. Vorschläge müssen die Phaser/React-Grenze, `Grid.tsx` als Transform-Basis, Inventar-Hierarchie, Tick-Pipeline und Save-Kompatibilität berücksichtigen.

## Pflichtformat für Architektur-Vorschläge

1. Ist-Zustand beschreiben: Phaser-Layer, React-Layer und Shared Grid getrennt darstellen.
2. Problem oder Motivation benennen: konkretes Risiko, konkrete Reibung oder konkrete Erweiterungsgrenze nennen.
3. Soll-Zustand vorschlagen: Zielbild mit klarer Verantwortlichkeit und ohne stillen Grenzbruch formulieren.
4. Betroffene Pfade auflisten, z. B. `src/game/store/action-handlers/`, `src/game/grid/`, `src/game/world/`, `src/game/ui/`, `src/game/simulation/`.
5. Migrationsrisiken benennen: Hotspots aus `factory-island-space/rules.md` ausdrücklich prüfen.

## Architektur-Vorschlagsraster

| Abschnitt | Leitfrage | Muss enthalten |
|---|---|---|
| Ist-Zustand | Wie funktioniert es heute? | Phaser-Layer, React-Layer, Shared Grid, relevante State-Felder. |
| Problem/Motivation | Warum ist eine Änderung nötig? | Konkrete Pain-Points, Bugs, Erweiterungsbedarf oder Wartungsrisiko. |
| Soll-Zustand | Wie soll es nachher aussehen? | Neue Verantwortlichkeiten, Datenfluss, Grenzen und Nicht-Ziele. |
| Betroffene Pfade | Wo wird geändert? | Konkrete Dateien oder Ordner, keine pauschalen Repo-weiten Aussagen. |
| Migrationsrisiken | Was kann brechen? | Save-Migration, Tick-Race, Inventar-Schicht, Drohnen-Sync, deprecated APIs. |

## Bekannte offene Migrationspfade

| Migrationspfad | Status | Regel |
|---|---|---|
| `starterDrone` ↔ `drones[id]` Konsolidierung | ⚠️ offen | Keine neue Drift erzeugen; bis zur Konsolidierung kanonische Sync-Helper nutzen. |
| Legacy-Imports via `reducer-public-api.ts` | 🔄 laufend | Neue Imports nach kanonischer Quelle ausrichten und keine neuen direkten Abhängigkeiten auf `reducer.ts` einführen. |
| `resolveWorkbenchSource` entfernen | 🗑️ deprecated | Keine neue Logik auf deprecated Source-Auflösung aufbauen; aktuellen Source-Pfad prüfen. |

## Refactoring-Regeln

- [ ] Änderungen müssen klein und lokal sein.
- [ ] Kein Big-Bang-Refactoring ohne ausdrücklichen Auftrag und vorherigen Plan.
- [ ] Architekturgrenzen zwischen Phaser und React dürfen nicht stillschweigend aufgeweicht werden.
- [ ] `Grid.tsx` als Transform-Basis darf nicht durch parallele Transform- oder Kamera-Logik ersetzt werden.
- [ ] Keine neuen Re-Export-Hubs ohne klaren Grund.
- [ ] Keine Spiellogik in UI-Komponenten verschieben.
- [ ] Keine Render-Details in Reducer-, Decision- oder Tick-Code verschieben.
- [ ] Persistente Schema-Änderungen immer mit Save-Migration und Normalisierung planen.
- [ ] Migrationspfade in kleinen Schritten schneiden, die einzeln baubar und testbar sind.

## Entscheidungsregeln

- [ ] Erst owning system bestimmen, dann nur die direkt betroffenen Codepfade lesen.
- [ ] Wenn Doku und Code widersprechen, gilt der Code; die Doku wird als Nachpflege markieren.
- [ ] Neue Abstraktionen nur einführen, wenn sie echte Komplexität reduzieren oder bestehende lokale Patterns stärken.
- [ ] Bei Hotspots aus `rules.md` Risiko, Teststrategie und Rückwärtskompatibilität ausdrücklich nennen.
