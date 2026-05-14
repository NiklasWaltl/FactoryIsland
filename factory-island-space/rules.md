---
name: factory-island-rules
description: Projektregeln für Factory Island. Aktivieren bei Architektur-, Zuständigkeits- und Strukturfragen.
---

# Factory Island Regeln

Diese Datei definiert verbindliche Architektur- und Verhaltensregeln für alle anderen Dateien in `factory-island-space/`.

## Rendering-Zuständigkeiten

| Bereich    | Phaser                                                                            | React                                                                         |
| ---------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Rendering  | Rendert Sprites, Tilemaps, Weltobjekte und Phaser-Overlays.                       | Rendert HUD, Panels, Menüs, Dialoge und sonstige DOM-UI.                      |
| Kamera     | Führt die Phaser-Kamera und deren Viewport nur für die Phaser-Welt.               | Nutzt keine zweite Weltkamera und erzeugt keinen zweiten World-Root.          |
| Grid-Input | Darf Grid-nahe Pointer-Signale visualisieren, aber keine State-Mutation auslösen. | `Grid.tsx` verarbeitet Grid-Input, Placement-Preview und UI-nahe Interaktion. |
| State      | Liest State-Snapshots read-only.                                                  | Hält State via `useReducer`, reicht `state` und `dispatch` an UI weiter.      |
| Mutation   | Niemals `dispatch`, keine direkte Store-Mutation.                                 | Mutiert ausschließlich über `dispatch(action)`.                               |

## Goldene Regel

Phaser ruft niemals `dispatch` auf. Phaser ist ein read-only Render-Layer, React und der Reducer sind die einzige Mutationsgrenze für `GameState`.

## World Transform

- `Grid.tsx` ist die einzige Quelle für Grid-/World-Transform im React-Layer.
- Es gibt keinen zweiten World-Root neben der bestehenden Grid-/World-Hierarchie.
- Es gibt keine zweite Kamera-Logik im React-Layer.
- Weltkoordinaten, Placement-Preview und Click-Zuordnung müssen auf der bestehenden Grid-Basis bleiben.
- Phaser-Kamera und React-Grid-Transform dürfen nicht stillschweigend entkoppelt werden.

## Inventar-Hierarchie

| Schicht                | Feld                             | Bedeutung                                                                                   | Regel                                                                    |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Globales Inventar      | `state.inventory`                | Globaler physischer Fallback-Pool, z. B. manuelle Ernte und Crafting ohne explizite Quelle. | Nur verwenden, wenn keine konkrete Warehouse-Quelle gemeint ist.         |
| Warehouse-Inventar     | `state.warehouseInventories[id]` | Physisches Lager eines Warehouse oder Service-Hubs.                                         | Für lagerbezogene Produktion, Lieferung und Entnahme verwenden.          |
| Network-Reservierungen | `state.network.reservations`     | Logische Holds auf physischem Bestand.                                                      | Reservierungen sind nicht physisch und dürfen Bestand nicht duplizieren. |

Physischer Stock liegt in `state.inventory` oder `state.warehouseInventories[id]`. `state.network.reservations` beschreibt nur gebundene Mengen und darf nicht als eigenes Lager behandelt werden.

## Tick-Pipeline

- Die App nutzt drei `setInterval`-Timer (Natural Spawn, Sapling-Polling, zentraler BASE_TICK-Orchestrator @ 100 ms). Der Orchestrator dispatcht innerhalb eines Durchlaufs in fester Reihenfolge `GENERATOR_TICK → ENERGY_NET_TICK → LOGISTICS_TICK → DRONE_TICK → JOB_TICK` und danach die unabhaengigen Workbench-/Lab-/Ship-/Notifications-Ticks; alle ehemaligen Einzelfrequenzen bleiben durch ganzzahlige Vielfache von BASE_TICK erhalten.
- Innerhalb eines BASE_TICK-Durchlaufs ist die Reihenfolge deterministisch. Zwischen den drei Timern (also auch zwischen Natural Spawn / Sapling-Polling / Orchestrator) ist die Browser-Reihenfolge nicht garantiert.
- Tick-Logik muss als pure Funktion über `state` formuliert sein.
- Tick-Handler ausserhalb der orchestrator-internen Reihenfolge dürfen nicht davon ausgehen, dass ein anderer Tick direkt vorher oder nachher gelaufen ist.
- Race-sensible Logik muss kommutativ genug sein oder explizit über State-Felder synchronisiert werden.

| Tick-Risiko                    | Verbindliche Regel                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Gleichzeitige Inventar-Updates | Bestandsänderungen immer über die kanonischen Helper und die betroffene Inventarschicht führen. |
| Crafting und Drohnen           | Reservierung, Pickup und Dropoff dürfen keine implizite Tick-Reihenfolge voraussetzen.          |
| Energie und Maschinen          | `machinePowerRatio` und `poweredMachineIds` als Ergebnis des Energy-Ticks behandeln.            |
| Notifications und Cleanup      | Wartungs-Ticks dürfen keine Fachlogik verstecken.                                               |

## Hotspots

| Hotspot                       | Risiko                                                   | Diagnosefrage                                                                      |
| ----------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Drei Inventare                | Falsche Schicht führt zu Stock-Inkonsistenz.             | Wird physischer Bestand oder nur eine logische Reservierung geändert?              |
| `starterDrone` ↔ `drones[id]` | Doppelte Drohnenquelle kann State-Drift erzeugen.        | Wird nach Änderungen an Drohnen `syncDrones()` oder der kanonische Helper genutzt? |
| Tick-Race                     | Nicht garantierte Reihenfolge erzeugt sporadische Bugs.  | Funktioniert die Logik auch, wenn ein anderer Tick vorher oder nachher läuft?      |
| Save-Migrations               | Alte Saves können bei Schema-Änderungen nicht hydrieren. | Gibt es für neue oder geänderte State-Felder eine Migration und Normalisierung?    |
| `resolveWorkbenchSource`      | Deprecated Quelle kann neue Source-Logik blockieren.     | Gibt es eine aktuelle Alternative im betroffenen Crafting-/Source-Pfad?            |

## Änderungsregeln

- [ ] Vor jeder Änderung die Zuständigkeit klären: Phaser-Render, React-UI, Reducer, Tick, Selector, Save oder Shared-Konstante.
- [ ] Keine stillen Architekturbrüche einführen, besonders nicht an Phaser/React-Grenze oder `Grid.tsx`-Transform.
- [ ] Kleine lokale Änderungen bevorzugen und nur direkt betroffene Pfade anfassen.
- [ ] Bei Schema-Änderungen immer Save-Migration und Compat-Normalisierung prüfen.
- [ ] Bei Inventarlogik zuerst die passende Schicht bestimmen: `state.inventory`, `warehouseInventories[id]` oder `network.reservations`.
- [ ] Bei Drohnenlogik `starterDrone` und `drones[id]` zusammen betrachten.
- [ ] Bei Tick-Logik keine Ausführungsreihenfolge voraussetzen.
- [ ] Wenn Code und Doku widersprechen, gilt der Code; die Doku wird als nachzupflegen markiert.
