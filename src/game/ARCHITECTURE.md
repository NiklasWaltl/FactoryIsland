# `src/game` — Architektur

> Architektur-, Runtime- und Datenfluss-Doku. Ist-Zustand. Bei Konflikten gilt der Code.
> **Stand:** verifiziert 2026-05-01.

---

## Wann lese ich diese Datei?

- Du willst verstehen, **wie** der Code zur Laufzeit zusammenspielt (Ticks, Dispatches, Render-Pfad).
- Du brauchst **Begründungen** für die Architektur (warum drei Inventarschichten, warum kein Re-Export-Hub, warum Phaser read-only).
- Du suchst die **logische Slice-Aufteilung** von `GameState` und ihre Persistenz-Status.

## Was finde ich hier nicht?

- **Welche Datei ist für X zuständig?** → [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) (Systemtabelle, Hotspots, Änderungsrezepte).
- **Welcher Typ existiert in Domain X?** → [TYPES.md](./TYPES.md) (Typ-Index pro Domain, Cross-Domain-Abhängigkeiten).

---

## Reading Order

Onboarding in dieser Reihenfolge:

1. [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) — Systemkarte, Routing.
2. Diese Datei — Runtime + Architekturentscheidungen.
3. [TYPES.md](./TYPES.md) — Typdomänen.
4. [`entry/FactoryApp.tsx`](./entry/FactoryApp.tsx) — Boot, Hydration, Save/HMR.
5. [`entry/use-game-ticks.ts`](./entry/use-game-ticks.ts) — alle Tick-Dispatches sichtbar.
6. [`store/types.ts`](./store/types.ts) ab L316 — `GameState`-Shape.
7. [`store/reducer.ts`](./store/reducer.ts) — dünner Reducer-Entry-Point.
8. [`store/game-reducer-dispatch.ts`](./store/game-reducer-dispatch.ts) — echte Dispatch-Kette.
9. [`store/game-actions.ts`](./store/game-actions.ts) — `GameAction`-Union.
10. [`crafting/README.md`](./crafting/README.md) — komplexestes Subsystem.

---

## High-Level-Architektur

```
React UI (HUD + Panels + Grid)        ← liest state, ruft dispatch
    ↓ dispatch
useReducer(gameReducer)               ← Single Source of Truth
    ↓ state
Phaser Renderer (PhaserHost/Game)     ← liest Snapshots, NIE dispatch
```

Drei strikt getrennte Welten:

- **Simulation** — pure Logik, keine DOM-/Canvas-Zugriffe.
- **React UI** — interaktive Mutation via `dispatch`.
- **Phaser Renderer** — read-only über State-Bridge.

Persistenz und HMR-Restore klinken sich seitlich ein, ohne Logik zu mutieren.

---

## Main Runtime Flow

```
main.factory.tsx
  └─ FactoryApp.tsx
       ├─ ModeSelect (debug | release)
       └─ GameInner (key=mode)
            ├─ useReducer(gameReducer | gameReducerWithInvariants)
            │     state: GameState  •  dispatch: (GameAction) => void
            ├─ useGameTicks(state, dispatch)
            │    └─ ~10× setInterval → dispatch({type: "X_TICK"})
            ├─ localStorage save (alle 10 s + beforeunload)
            ├─ HMR-State-Restore (DEV)
            ├─ Grid (Phaser-Host + React-Overlays)
            └─ HUD + Panels (state als Prop, dispatch als Prop)
```

Alle Mutationen laufen über `dispatch`. Phaser ist read-only über `state`-Snapshots. Tick-Reihenfolge innerhalb eines Browser-Frames ist **nicht garantiert** — jeder Tick ist ein eigener `setInterval`.

---

## Tick Pipeline

| Tick | Intervall (ms) | Action | Trigger | Handler | Primary state writes |
|---|---|---|---|---|---|
| Sapling Growth | 1000 | `GROW_SAPLINGS` | immer | [`growth-actions`](./store/action-handlers/growth-actions/) | `assets`, `cellMap`, `saplingGrowAt` |
| Natural Spawn | 60 000 | `NATURAL_SPAWN` | immer | [`growth-actions`](./store/action-handlers/growth-actions/) | `assets`, `cellMap`, `saplingGrowAt` |
| Smithy | 100 | `SMITHY_TICK` | nur wenn `smithy.processing` | [`machine-actions`](./store/action-handlers/machine-actions.ts) | `smithy` |
| Manual Assembler | 100 | `MANUAL_ASSEMBLER_TICK` | nur wenn `manualAssembler.processing` | [`manual-assembler-actions.ts`](./store/action-handlers/manual-assembler-actions.ts) | `manualAssembler`, Source-Inventar, `notifications` |
| Generator | 200 | `GENERATOR_TICK` | nur wenn min. 1 Generator läuft | [`machine-actions`](./store/action-handlers/machine-actions.ts) | `generators` |
| Energy Net | 2000 | `ENERGY_NET_TICK` | immer | inline `switch` → [`energy-net-tick.ts`](./store/energy/energy-net-tick.ts) | `battery.stored`, `poweredMachineIds`, `machinePowerRatio` |
| Logistics | 500 | `LOGISTICS_TICK` | immer | inline `switch` → [`logistics-tick.ts`](./store/action-handlers/logistics-tick.ts) | `autoMiners`, `conveyors`, `autoSmelters`, `inventory`, `warehouseInventories`, `smithy`, `notifications`, `autoDeliveryLog` |
| Crafting Jobs | 500 | `JOB_TICK` | nur wenn pending Jobs ODER aktive Keep-Stock-Targets | [`crafting-queue-actions`](./store/action-handlers/crafting-queue-actions/) | `crafting`, `network`, physische Inventare, `keepStockByWorkbench` |
| Drones | 500 | `DRONE_TICK` | immer | [`drone-tick-actions`](./store/action-handlers/drone-tick-actions/) | `drones`, `starterDrone`, Ziel-Inventare, `crafting` (Input-Buffer + Delivery), `collectionNodes` |
| Notifications | 500 | `EXPIRE_NOTIFICATIONS` | immer | [`maintenance-actions`](./store/action-handlers/maintenance-actions/) | `notifications` |

Konstanten in [`store/constants/timing/timing.ts`](./store/constants/timing/timing.ts), [`store/constants/energy/`](./store/constants/energy/), [`store/constants/timing/workbench-timing.ts`](./store/constants/timing/workbench-timing.ts).

**Konsequenz der Unbestimmtheit:** Tick-Logik muss kommutativ-genug sein. Race-Bedingungen sind toleriert, weil jeder Tick einen kompletten Reducer-Pass macht und keine Tick-übergreifenden Zwischenzustände existieren.

---

## Datenfluss

### Schreibpfad

```
UI-Event / setInterval
  → dispatch(action)
  → gameReducer(state, action)
       → handleXAction(state, action, deps?) → GameState | null   [Cluster-Kette]
       → inline switch(action)                                    [Fallback]
  → neuer state
  → React Re-Render
  → Phaser Bridge konsumiert Snapshot
  → Save-Codec (alle 10 s) → localStorage
```

### Lesepfad

UI und Phaser konsumieren `state` ausschließlich als Prop / Snapshot. Read-only Aggregationen für UI/Drones leben in [`store/selectors/`](./store/selectors/).

### Inventar-Datenfluss

`GameState` enthält drei Inventarschichten, die zusammen die Wahrheit über Stock bilden:

1. `inventory` — globaler Fallback-Pool.
2. `warehouseInventories[id]` — physische Lager.
3. `network.reservations` — logische Holds auf (1)+(2).

**Kanonisch:** physisch ist Source-of-Truth; `network` ist abgeleitet. Reservations werden über Owner-Keys (Konvention: `ownerKey === jobId`) verwaltet.
Detail-Routing zu Inventar-Code: [/SYSTEM_REGISTRY.md §5.4](../../SYSTEM_REGISTRY.md).

---

## State Map

`GameState` ist in [`store/types.ts:316`](./store/types.ts#L316) ein einziges Flat-Interface mit ~62 Feldern. Logisch zerfällt es in folgende Slices:

| Slice (logisch) | Felder | Persistiert |
|---|---|---|
| **Identity** | `mode` | ja |
| **Inventories** | `inventory`, `warehouseInventories`, `network` | ja |
| **Assets / World** | `assets`, `cellMap`, `floorMap`, `collectionNodes`, `saplingGrowAt` | ja |
| **Build / Shop** | `purchasedBuildings`, `placedBuildings`, `warehousesPurchased`, `warehousesPlaced`, `cablesPlaced`, `powerPolesPlaced`, `buildMode`, `selectedBuildingType`, `selectedFloorTile` | tw. |
| **Hotbar** | `hotbarSlots`, `activeSlot` | ja |
| **Machines** | `smithy`, `manualAssembler`, `autoMiners`, `autoSmelters`, `conveyors`, `generators`, `battery` | ja |
| **Energy** | `connectedAssetIds`, `poweredMachineIds`, `machinePowerRatio`, `energyDebugOverlay` | tw. |
| **Drones / Hubs** | `starterDrone`, `drones`, `serviceHubs`, `constructionSites` | ja |
| **Zones** | `productionZones`, `buildingZoneIds`, `buildingSourceWarehouseIds` | ja |
| **Crafting** | `crafting`, `keepStockByWorkbench`, `recipeAutomationPolicies` | ja |
| **UI (transient)** | `openPanel`, `selectedWarehouseId`, `selectedPowerPoleId`, `selectedAutoMinerId`, `selectedAutoSmelterId`, `selectedGeneratorId`, `selectedServiceHubId`, `selectedCraftingBuildingId`, `notifications`, `autoDeliveryLog` | nein |

`starterDrone` und `drones[id]` werden synchron gehalten — Legacy für Backward-Compat. (*UNSICHER:* Migrationspfad nicht dokumentiert; `syncDrones` siehe [`drones/utils/drone-state-helpers.ts`](./drones/utils/drone-state-helpers.ts).)

Typ-Definitionen aller Slice-Felder: siehe [TYPES.md](./TYPES.md).

---

## React vs Phaser vs Reducer — Boundaries

| Layer | Verzeichnis(se) | Schreibt State? | Liest State? |
|---|---|---|---|
| **Simulation (Pure Logic)** | [`store/`](./store/) (inkl. [`store/selectors/`](./store/selectors/)), [`crafting/`](./crafting/), [`drones/`](./drones/), [`inventory/`](./inventory/), [`logistics/`](./logistics/), [`zones/`](./zones/), [`power/`](./power/), [`buildings/`](./buildings/), [`simulation/`](./simulation/) | nur via Reducer | — |
| **UI (React)** | [`ui/`](./ui/), [`grid/Grid*.tsx`](./grid/) | nur via `dispatch` | ja, als Prop |
| **Renderer (Phaser)** | [`world/PhaserGame.ts`](./world/PhaserGame.ts), [`world/PhaserHost.tsx`](./world/PhaserHost.tsx), [`assets/sprites/`](./assets/sprites/) | nie | snapshot via Bridge |
| **Persistence** | [`simulation/save*.ts`](./simulation/) | nur Codec | hydratiert State |
| **Debug** | [`debug/`](./debug/) | via `DEBUG_SET_STATE` | ja |
| **Entry / Bootstrap** | [`entry/`](./entry/) | indirekt | ja |

**Goldene Regel:** Phaser darf nie `dispatch` aufrufen. UI-Events sind die einzige Quelle interaktiver Mutationen außer Tickern.

**Begründung:** Phaser ist Render-Output, kein Eingabekanal. Würde Phaser dispatchen, entstünde ein zweiter Mutationspfad neben React — Tests, Replay und Save-Hydration verlassen sich darauf, dass jede Zustandsänderung über `dispatch` läuft.

---

## Wichtige Architekturentscheidungen

### 1. `GameAction` ist eigenständig (Wave 2/3/3.5)

[`store/game-actions.ts`](./store/game-actions.ts) ist die einzige kanonische Quelle der `GameAction`-Union. Kein Reducer-Code, kein Logik-Mix — reine Type-Definition. `actions.ts` (ehemals reiner Re-Export) wurde entfernt; alle 45 Handler importieren direkt.

**Begründung:** `grep "type GameAction ="` ergibt genau einen Treffer. Findability für LLMs und Menschen.

### 2. Read-only Selektoren in `store/selectors/`

[`store/selectors/`](./store/selectors/) enthält ausschließlich nicht-mutierende Aggregationen (Zone, Source-Status, Conveyor-Zone-Status). `reducer.ts` re-exportiert sie nur aus Compat-Gründen.

**Begründung:** UI- und Drone-Code soll direkt aus `selectors/` importieren, nicht über `reducer.ts`. Ein Symbol — eine kanonische Datei.

### 3. Konstanten direkt aus `constants/`

Grid- und Building-Konstanten (`GRID_W`, `GRID_H`, `CELL_PX`, `WAREHOUSE_CAPACITY`) werden direkt aus [`constants/grid.ts`](./constants/grid.ts) bzw. [`store/constants/buildings/index.ts`](./store/constants/buildings/index.ts) importiert. `reducer.ts` ist kein Re-Export-Hub mehr.

### 4. Cluster-Handler-Kette statt Mega-Switch

`dispatchAction` in [`store/game-reducer-dispatch.ts`](./store/game-reducer-dispatch.ts) ist die Dispatch-Kette aus `handleXAction(state, action, deps?) → GameState | null`. Jeder Handler entscheidet per `HANDLED_ACTION_TYPES`-Set, ob er zuständig ist; `null` = Fallthrough. Verbleibende Actions landen im inline `switch` am Ende dieser Datei. [`store/reducer.ts`](./store/reducer.ts) bleibt der dünne öffentliche Entry-Point.

**Begründung:** Clusters sind nach Domäne (Crafting, Drones, Energy) gruppiert. Eine Domänen-Änderung berührt nur einen Cluster. Deps werden injiziert, um ESM-Zyklen mit `reducer.ts` zu vermeiden.

### 5. Drei Inventarschichten koexistieren

`inventory` (global) / `warehouseInventories` (physisch) / `network` (logisch reserviert). Physisch ist Source-of-Truth.

**Begründung:** Reservierungen müssen unabhängig vom physischen Stock greifen können (Crafting reserviert, bevor es liefert), aber das physische Inventar muss jederzeit ohne Reservation-Lookup lesbar bleiben (manuelle Ernte, UI).

### 6. Strikte Trennung Planning vs. Execution im Crafting-Tick

`crafting/tick.ts` + `crafting/tickPhases.ts` trennen Plan-Phase (entscheiden, was passiert) von Execute-Phase (state mutieren).

**Begründung:** Planning kann iterativ Kandidaten verwerfen, ohne State-Inkonsistenzen zu hinterlassen.

### 7. Tick-Reihenfolge bewusst unbestimmt

Keine globale Tick-Orchestrierung — jeder `setInterval` läuft unabhängig.

**Begründung:** Einfacher als ein zentraler Scheduler. Race-Conditions sind tolerabel, weil jeder Tick einen kompletten Reducer-Pass macht. (*UNSICHER:* Race-Sicherheit pro Tick nicht formal geprüft.)

---

## Glossary

| Begriff | Bedeutung |
|---|---|
| **Asset** | Platziertes World-Object (Building, Tree, Deposit, Drone-fähig). Keyed by `assetId`. |
| **Cell** | 1×1 Grid-Tile. Adressiert via `cellKey(x,y)` aus [`store/utils/cell-key.ts`](./store/utils/cell-key.ts). |
| **Hub / Service Hub** | Drone-Heimatbasis mit eigenem Inventar (`ServiceHubInventory`). |
| **Workbench** | Crafting-Asset; wird von Crafting-Jobs belegt. |
| **Network Slice** | Logische Reservierungen auf physischem Inventar. Definiert in [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts). |
| **Owner** | Eigentümer einer Reservierung. Konvention: `ownerKey === jobId`. |
| **Source / CraftingInventorySource** | Diskriminierte Union: `global` \| `warehouse` \| `zone`. |
| **Zone / ProductionZone** | Logische Gruppierung von Buildings + Warehouses mit aggregiertem Stock. |
| **Job-Lifecycle** | `queued → reserved → crafting → delivering → done|cancelled`. |
| **Keep-Stock-Target** | Pro-Workbench/Recipe Auto-Refill-Schwelle. |
| **Tick-Phase** | Innerer Schritt eines Tick-Handlers (z. B. `auto-miner` in `LOGISTICS_TICK`). |
| **Cluster** | Gruppe verwandter Action-Types mit gemeinsamem Handler unter `store/action-handlers/`. |
| **Deps** | An Handler injizierte Reducer-interne Helper. Vermeidet ESM-Zyklen. |
| **HMR** | Hot Module Replacement. State wird in `sessionStorage` gespiegelt. |
| **Construction Site** | Building, das noch Ressourcen-Schulden hat. Drones liefern. |
| **DroneRole** | `auto | construction | supply` — beeinflusst nur Task-Scoring; Rollenwechsel mutiert ausschließlich `drone.role`, bricht laufende Tasks **nicht** ab. |

---

## Verweise

- [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) — System-Routing, Pfade, Hotspots, Änderungsrezepte.
- [TYPES.md](./TYPES.md) — Typdomänen und Cross-Domain-Abhängigkeiten.
- [`crafting/README.md`](./crafting/README.md) — Job-Lifecycle im Detail.
