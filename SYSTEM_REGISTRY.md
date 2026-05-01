# SYSTEM_REGISTRY.md

> AI-freundliche Navigationskarte für Factory Island. Ist-Zustand, kein Soll-Zustand.
> Stand: verifiziert 2026-05-01.

---

## 1. Zweck

Kompakter Index aller Kernsysteme mit Pfaden, Verantwortlichkeiten, Lese-/Schreibgrenzen und Einstiegspunkten — damit zukünftige Prompts den richtigen Code in 1–2 Tool-Calls finden, ohne erst zu explorieren.

Tiefere Inhalte: siehe [src/game/ARCHITECTURE.md](src/game/ARCHITECTURE.md), [src/game/TYPES.md](src/game/TYPES.md), [README.md](README.md).

---

## AI-Nutzung dieser Datei

Nutze diese Datei als Routing-Übersicht, nicht als Detaildokument.
Wenn eine Aufgabe genannt wird:
1. Bestimme zuerst das betroffene System.
2. Lies dann nur die genannten Hauptpfade dieses Systems.
3. Ziehe ARCHITECTURE.md nur für Runtime- oder Datenflussfragen hinzu.
4. Ziehe TYPES.md nur für Typ-/Domainfragen hinzu.
5. Wenn eine Information hier als UNSICHER markiert ist, validiere sie im Code, bevor du Änderungen vorschlägst.

### Task-zu-System-Matrix

| Task | Primäre Systeme | Sekundäre Systeme |
|---|---|---|
| Neues Building | Building Placement, Reducer, UI-Panels | Inventory, Energy |
| Neues Rezept | Crafting, Simulation/Recipes | Inventory, UI-Panels |
| Neues UI-Panel | UI-Panels | Store, Selection-State |
| Neue Drohnenregel | Drones | Inventory, Tick-Pipeline |

---

## 2. Stack & Leitregeln

- **Stack:** React 18 + TypeScript + Phaser 3 + Vite. Tests via Jest. Yarn 1.x.
- **State:** ein einziger `useReducer` (`GameState` in [src/game/store/types.ts](src/game/store/types.ts)). Single source of truth.
- **Tick-getrieben:** ~10 unabhängige `setInterval` in [src/game/entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts) (eingehängt aus [src/game/entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx)) → `dispatch({type: "*_TICK"})`.
- **Goldene Regel:** Phaser ruft NIE `dispatch`. Nur React-UI darf mutieren. Phaser liest Snapshots.
- **Action-Discoverability:** `grep "case \"X_ACTION\":" src/game` ergibt genau einen Treffer.
- **`GameAction`-Union:** kanonisch in [src/game/store/game-actions.ts](src/game/store/game-actions.ts). Kein Re-Export-Hub.
- **Persistenz:** `localStorage` alle 10 s + `beforeunload`. HMR-Restore via `sessionStorage`.
- **Determinismus:** alle Tick-Logik pure Funktionen über `state`.

---

## 3. Runtime-Karte

1. `main.factory.tsx` bootet React → mountet `FactoryApp`.
2. `FactoryApp` wählt Mode (`debug` | `release`) und mountet `GameInner` mit `key=mode`.
3. `GameInner` initialisiert `useReducer(gameReducer)` und ~10 Tick-Intervalle.
4. UI (HUD + Panels) liest `state` als Prop und ruft `dispatch` direkt.
5. Phaser (`PhaserHost` + `PhaserGame`) erhält State-Snapshots zur Render-Synchronisation.
6. Alle Mutationen → `dispatch(action)` → `gameReducer` → Cluster-Handler-Kette → neuer State.
7. Save-Codec serialisiert `GameState` periodisch in `localStorage`; Hydration beim Mount.
8. Tick-Reihenfolge innerhalb eines Browser-Frames ist NICHT garantiert.

---

## 4. Kernsysteme — Übersicht

| System | Hauptpfad | Verantwortung | Liest | Schreibt | Abhängigkeiten | Nicht zuständig für |
|---|---|---|---|---|---|---|
| **Entry / Bootstrap** | [src/game/entry/](src/game/entry/) | App-Shell, Reducer-Mount, Tick-Intervalle, HMR-Restore | `state` (Lifecycle) | `dispatch` | Store, UI, Save | Game-Logik, Rendering |
| **Reducer / Dispatch** | [src/game/store/reducer.ts](src/game/store/reducer.ts), [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts) | Zentrale Action-Dispatch-Kette | gesamter `GameState` | gesamter `GameState` | alle Action-Handler | UI, Rendering |
| **Action-Handlers** | [src/game/store/action-handlers/](src/game/store/action-handlers/) | Cluster-Handler pro Action-Typ | `state` + `deps` | Slices via Pure Updates | Decisions, Helpers, Selectors | Tick-Scheduling |
| **Game-Actions Union** | [src/game/store/game-actions.ts](src/game/store/game-actions.ts) | Kanonische `GameAction`-Discriminated-Union | — | — | Item/Recipe-Typen | Logik (nur Typen) |
| **Crafting** | [src/game/crafting/](src/game/crafting/) | Job-Lifecycle: queued→reserved→crafting→delivering→done | `crafting`, `network`, Inventare | `crafting`, Inventare, `keepStockByWorkbench` | Inventory, Items, Recipes | Drohnen-Bewegung |
| **Drones** | [src/game/drones/](src/game/drones/) | Task-Selection, Movement, Cargo-FSM | `drones`, `assets`, `crafting`, Inventare | `drones`, `starterDrone`, Ziel-Inventare, `collectionNodes` | Decisions, Selectors | Energie, Crafting-Planung |
| **Inventory / Reservations** | [src/game/inventory/](src/game/inventory/) | Logische Holds auf physischem Stock (`network`) | `inventory`, `warehouseInventories`, `network` | `network` (Reservations) | Items | Physische Bewegung |
| **Items** | [src/game/items/](src/game/items/) | `ItemId`-Union, Item-Registry, Stack-Größen | — | — | — | Recipes |
| **Recipes** | [src/game/simulation/recipes/](src/game/simulation/recipes/) | Statische Rezeptdefinitionen pro Workbench-Typ | — | — | Items | Crafting-Lifecycle |
| **Logistics-Tick** | [src/game/store/action-handlers/logistics-tick.ts](src/game/store/action-handlers/logistics-tick.ts) (+ `logistics-tick/`) | AutoMiner, Conveyor, AutoSmelter pro 500ms | `assets`, Inventare, `conveyors` | `inventory`, `warehouseInventories`, `autoMiners`, `autoSmelters`, `conveyors`, `notifications` | Decisions, Conveyor | Drohnen, Crafting |
| **Energy / Power** | [src/game/store/energy/](src/game/store/energy/), [src/game/power/](src/game/power/) | Netz-Konnektivität, Verbraucher-Priorität, Generator-Burn | `assets`, `cellMap`, `constructionSites`, `generators`, `battery`, `connectedAssetIds` | `poweredMachineIds`, `machinePowerRatio`, `generators`, `battery` | Decisions | Crafting, Logistics |
| **Buildings** | [src/game/buildings/](src/game/buildings/), [src/game/store/constants/buildings/](src/game/store/constants/buildings/) | Building-Definitionen, Input-Targets, Service-Hub-/Warehouse-Helper | `assets`, `placedBuildings` | über Reducer | Items | Placement-Validierung |
| **Zones** | [src/game/zones/](src/game/zones/) | Production-Zone-Aggregation und Cleanup | `productionZones`, `assets` | `productionZones`, `buildingZoneIds`, `buildingSourceWarehouseIds` | Decisions | Crafting-Plan |
| **Conveyor** | [src/game/store/conveyor/](src/game/store/conveyor/) | Belt-Geometrie, Routing, Underground-Pairing | `conveyors`, `assets` | über Logistics-Tick | — | Item-Definition |
| **Decisions** | [src/game/store/decisions/](src/game/store/decisions/) | Reine Eligibility-/Placement-/Dropoff-Logik | `state` (read-only) | — | Helpers, Selectors | State-Mutation |
| **Selectors** | [src/game/store/selectors/](src/game/store/selectors/) | Read-only Aggregations für UI/Drones | `state` | nie | — | Mutation |
| **Grid (UI)** | [src/game/grid/](src/game/grid/) | Click-Handling, Overlays, Placement-Preview | `state` | `dispatch` | UI-Helpers | Phaser-Render |
| **World (Phaser)** | [src/game/world/](src/game/world/) | Phaser-Game + React-Host für Rendering | State-Snapshot | nie | Sprites | Logik |
| **UI Panels / HUD** | [src/game/ui/panels/](src/game/ui/panels/), [src/game/ui/hud/](src/game/ui/hud/) | Side-Panels pro Building, Hotbar, Notifications | `state` | `dispatch` | Selectors | Logik |
| **Persistence (Save)** | [src/game/simulation/](src/game/simulation/) | localStorage-Codec, Migrations, Normalizer | `state` | nie (im Reducer-Sinn) | Types | Live-State |
| **Debug** | [src/game/debug/](src/game/debug/) | DEV-Tools, Debug-Overlays (tree-shaken) | `state` | via `DEBUG_SET_STATE` | — | Production |
| **Constants** | [src/game/constants/](src/game/constants/), [src/game/store/constants/](src/game/store/constants/) | Grid-Dimensionen, Timing, Capacities, Recipes-Constants | — | — | — | — |

---

## 5. Detailkarten

### 5.1 Reducer & Dispatch-Kette

- **Einstieg:** [reducer.ts](src/game/store/reducer.ts) — dünner Entry-Point für `gameReducer` + `gameReducerWithInvariants`.
- **Echte Dispatch-Logik:** [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts) (extrahiert).
- **Pattern:** Kette aus `handleXAction(state, action, deps?) → GameState | null`. `null` = Fallthrough. Verbleibende Actions → inline `switch`.
- **Public API:** [reducer-public-api.ts](src/game/store/reducer-public-api.ts) — Re-Exports für externe Konsumenten.

### 5.2 Crafting-System

- **README:** [src/game/crafting/README.md](src/game/crafting/README.md).
- **Lifecycle:** `queued → reserved → crafting → delivering → done|cancelled` ([crafting/types.ts](src/game/crafting/types.ts)).
- **Drei Schichten:** Reservation (`inventory/`) · Queue (`crafting/queue/`) · Tick-Phasen (`crafting/tick.ts` + `crafting/tickPhases.ts`).
- **Cluster-Handler:** [crafting-queue-actions/](src/game/store/action-handlers/crafting-queue-actions/).
- **Strikte Trennung:** Planning vs. Execution Phase im Tick.
- **Source-Union:** `global | warehouse | zone` — bestimmt, woher gelesen und wohin geliefert wird.

### 5.3 Drones

- **Task-Auswahl:** [drones/selection/select-drone-task.ts](src/game/drones/selection/select-drone-task.ts) — Scoring-basiert.
- **Tasktypen:** `construction_supply`, `hub_restock`, `hub_dispatch`, `workbench_delivery`, `building_supply` ([store/types.ts](src/game/store/types.ts)).
- **Roles:** `auto | construction | supply` — beeinflussen NUR Scoring (Bonus); kein hartes Filter. Rollenwechsel bricht laufende Tasks NICHT ab.
- **Sync-Falle:** `starterDrone` ↔ `drones[id]` — duplizierter State, gehalten via `syncDrones` ([drones/utils/drone-state-helpers.ts](src/game/drones/utils/drone-state-helpers.ts)). UNSICHER: Migrationspfad zur Konsolidierung nicht dokumentiert.
- **FSM:** `DroneStatus` (idle / moving_to_collect / collecting / moving_to_dropoff / …).

### 5.4 Inventar-Hierarchie (kritische Verwirrungsquelle)

| Schicht | Feld | Rolle |
|---|---|---|
| 1 | `state.inventory` | Globaler Fallback-Pool (manuelle Ernte, Crafting ohne explizite Quelle) |
| 2 | `state.warehouseInventories[id]` | Physische Lager — Auto-Delivery landet hier |
| 3 | `state.network.reservations` | Logische Holds auf (1)+(2). NICHT physisch. |

**Kanonisch:** Physisches Inventar ist Source-of-Truth. `network` ist nur abgeleitete Holds. Reservierungen werden über Owner-Keys (Konvention: `ownerKey === jobId`) verwaltet.

### 5.5 Tick-Pipeline

| Tick | ms | Bedingung | Handler |
|---|---|---|---|
| `GROW_SAPLINGS` | 1000 | immer | growth-actions |
| `SMITHY_TICK` | 100 | nur wenn processing | machine-actions |
| `MANUAL_ASSEMBLER_TICK` | 100 | nur wenn processing | manual-assembler-actions |
| `GENERATOR_TICK` | 200 | min. 1 läuft | machine-actions |
| `ENERGY_NET_TICK` | 2000 | immer | energy-net-tick |
| `LOGISTICS_TICK` | 500 | immer | logistics-tick |
| `JOB_TICK` | 500 | pending Jobs OR Keep-Stock-Targets | crafting-queue-actions |
| `DRONE_TICK` | 500 | immer | drone-tick-actions |
| `EXPIRE_NOTIFICATIONS` | 500 | immer | maintenance-actions |
| `NATURAL_SPAWN` | 60000 | immer | growth-actions |

Alle Tick-Intervalle liegen in [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts); [entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx) bindet den Hook ein.

### 5.6 Energy-Netz

- **Tick-Phasen:** [store/energy/](src/game/store/energy/) — Production, Consumers (Priority-sortiert), Distribution.
- **Konnektivität:** [logistics/connectivity.ts](src/game/logistics/connectivity.ts) — BFS über Asset-Topologie und Pole-Reichweite.
- **Schreibzugriff:** `poweredMachineIds`, `machinePowerRatio`, `battery.stored`; `connectedAssetIds` wird bei Topologie-Änderungen separat via `computeConnectedAssetIds()` aktualisiert.
- **Verbraucher-Priorität:** `MachinePriority` 1..5 — kleinere Zahl = früherer Stromzugriff (`1` = höchste Priorität).

### 5.7 Action-Cluster (häufigste Einstiege)

| Cluster | Pfad | Anteil Actions |
|---|---|---|
| Crafting | [crafting-queue-actions/](src/game/store/action-handlers/crafting-queue-actions/) | 13 |
| Building Placement | [building-placement.ts](src/game/store/action-handlers/building-placement.ts) + [building-placement/](src/game/store/action-handlers/building-placement/) | 2 |
| Machines | [machine-actions.ts](src/game/store/action-handlers/machine-actions.ts) + [machine-actions/](src/game/store/action-handlers/machine-actions/) | viele |
| Click-Cell | [click-cell.ts](src/game/store/action-handlers/click-cell.ts) | 1 (zentral, dispatcht intern) |
| Logistics | [logistics-tick.ts](src/game/store/action-handlers/logistics-tick.ts) + [logistics-tick/](src/game/store/action-handlers/logistics-tick/) | 1 |

### 5.8 UI-Panels (1 Panel pro Building-Typ)

[src/game/ui/panels/](src/game/ui/panels/): `WarehousePanel`, `SmithyPanel`, `WorkbenchPanel`, `ManualAssemblerPanel`, `AutoAssemblerPanel`, `AutoMinerPanel`, `AutoSmelterPanel`, `BatteryPanel`, `GeneratorPanel`, `MapShopPanel`, `PowerPolePanel`, `ServiceHubPanel`, `EnergyDebugOverlay`, `ZoneSourceSelector`. Trigger via `openPanel`-Feld + `selectedXxxId`.

---

## 6. Hotspots & Risikobereiche

| Hotspot | Datei / Bereich | Risiko |
|---|---|---|
| **Drei Inventare** | `inventory` / `warehouseInventories` / `network` | Falsche Schicht editiert → Stock-Inkonsistenz |
| **`starterDrone` ↔ `drones[id]`** | [drones/utils/drone-state-helpers.ts](src/game/drones/utils/drone-state-helpers.ts) | Beide editieren ohne `syncDrones` → Drift |
| **Tick-Race** | [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts) | Reihenfolge unbestimmt; Logik muss kommutativ-genug sein |
| **Reducer-Split** | [reducer.ts](src/game/store/reducer.ts), [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts) | Thin Entry-Point und echte Dispatch-Kette liegen in getrennten Dateien |
| **Phase-File-Explosion** | `crafting-queue-actions/phases/` | Eine Änderung berührt typischerweise 3 Dateien (Index + Phase + Deps) |
| **Save-Migrations** | [simulation/save-migrations.ts](src/game/simulation/save-migrations.ts) | Schema-Änderung ohne Migration → Hydration-Fehler bei Bestandsspeichern |
| **Energy-Konsumenten-Priorität** | [power/energy-priority.ts](src/game/power/energy-priority.ts) | Ordering-Bugs → falsche `machinePowerRatio` |
| **`GameState` ist Flat-Interface** | [store/types.ts:316](src/game/store/types.ts#L316) | ~62 Felder; logische Slice-Trennung nur konzeptuell |
| **HMR-Restore** | [entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx) | DEV-only Code; nicht in Prod testen |

---

## 7. Änderungsrezepte

### 7.1 Neues Building hinzufügen

1. **Item-ID** (falls eigenes Item): [items/registry.ts](src/game/items/registry.ts) + ggf. [items/types.ts](src/game/items/types.ts).
2. **Building-Definition:** [src/game/store/constants/buildings/registry.ts](src/game/store/constants/buildings/registry.ts) (Größe, Kosten, Strombedarf).
3. **AssetType-Union:** in [store/types.ts](src/game/store/types.ts) erweitern (sofern neuer Asset-Typ).
4. **Initial-State / Slice:** falls eigenes Slice nötig (z. B. analog `autoSmelters`), in [initial-state.ts](src/game/store/initial-state.ts) + `GameState` ergänzen.
5. **Placement-Validierung:** [grid/placement-validation.ts](src/game/grid/placement-validation.ts) berücksichtigen.
6. **Tick-Handler** (falls verarbeitend): neuen Cluster unter [store/action-handlers/](src/game/store/action-handlers/) anlegen, Action zur Union in [game-actions.ts](src/game/store/game-actions.ts) hinzufügen, `setInterval` in [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts) registrieren.
7. **Sprite/Render:** [src/game/world/PhaserGame.ts](src/game/world/PhaserGame.ts) + [assets/sprites/](src/game/assets/sprites/).
8. **UI-Panel:** neue Datei in [ui/panels/](src/game/ui/panels/), `UIPanel`-Union in [store/types.ts](src/game/store/types.ts) erweitern, `TOGGLE_PANEL` greift automatisch.
9. **Save-Migration:** falls Slice neu → [simulation/save-migrations.ts](src/game/simulation/save-migrations.ts) Eintrag.

### 7.2 Neues Rezept hinzufügen

1. **Output/Input-Items** in [items/registry.ts](src/game/items/registry.ts) sicherstellen.
2. **Recipe-Datei wählen** (passend zum Workbench-Typ):
   - Smithy → [SmeltingRecipes.ts](src/game/simulation/recipes/SmeltingRecipes.ts)
   - Manual Assembler → [ManualAssemblerRecipes.ts](src/game/simulation/recipes/ManualAssemblerRecipes.ts)
   - Auto Assembler → [AutoAssemblerV1Recipes.ts](src/game/simulation/recipes/AutoAssemblerV1Recipes.ts)
   - Workbench → [WorkbenchRecipes.ts](src/game/simulation/recipes/WorkbenchRecipes.ts)
3. Eintrag mit `id`, `inputs[]`, `outputs[]`, `durationMs`, `workbenchType` ergänzen.
4. **Index re-exportiert automatisch** über [recipes/index.ts](src/game/simulation/recipes/index.ts).
5. **Keine Reducer-Änderung nötig** — Rezepte werden zur Laufzeit aus der Registry gelesen.
6. UI listet Rezepte automatisch im jeweiligen Panel; ggf. Sprite/Display-Name in [items/registry.ts](src/game/items/registry.ts) prüfen.

### 7.3 Neues UI-Panel

1. Komponente unter [ui/panels/](src/game/ui/panels/) erstellen, Props: `state`, `dispatch`, ggf. selektierte ID.
2. `UIPanel`-Union in [store/types.ts](src/game/store/types.ts) um neuen Wert erweitern.
3. Falls selektionsabhängig: neues `selectedXxxId`-Feld in `GameState` + Reset in `CLOSE_PANEL`/`TOGGLE_PANEL` ([store/action-handlers/ui-actions.ts](src/game/store/action-handlers/ui-actions.ts)).
4. Click-Handler: Trigger in [store/action-handlers/click-cell.ts](src/game/store/action-handlers/click-cell.ts) (öffnet Panel beim Asset-Klick).
5. Panel-Routing in der Render-Hierarchie ([ui/](src/game/ui/) Hauptlayout) ergänzen — Pattern: `state.openPanel === "xxx" && <XxxPanel … />`.
6. Selectors für Read-Only-Daten in [store/selectors/](src/game/store/selectors/) anlegen — UI nicht direkt aus `reducer.ts` importieren.

---

## 8. Verweise

- [src/game/ARCHITECTURE.md](src/game/ARCHITECTURE.md) — Tiefenarchitektur, Reading-Order, Tick-Pipeline-Details, Glossar.
- [src/game/TYPES.md](src/game/TYPES.md) — Typ-Index pro Domain (Store, Crafting, Items, Inventory, Drones).
- [src/game/crafting/README.md](src/game/crafting/README.md) — Job-Lifecycle im Detail.
- [README.md](README.md) — Setup, Build, Test.
- [AGENTS.md](AGENTS.md) — AI-Agent-Guidelines.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — bekannte Probleme.

---

## TODO / UNSICHER

- **`starterDrone` ↔ `drones[id]` Migrationspfad:** unklar dokumentiert. Siehe ARCHITECTURE.md §State Map.
- **Tick-Reihenfolge-Garantien:** keine globale Orchestrierung. Race-Sicherheit pro Tick nicht formal geprüft.
