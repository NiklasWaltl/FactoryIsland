# `logistics-tick/` — `LOGISTICS_TICK` Phasenkette

> Orchestrator: [`../logistics-tick.ts`](../logistics-tick.ts).
> Diese README dokumentiert die interne Phasenreihenfolge sowie die
> Schreibpfade von Auto-Smelter- und Auto-Assembler-Phase, weil beide
> nirgends sonst sichtbar sind.

---

## Phasenreihenfolge (fix, sequenziell)

| # | Phase | Datei | Zweck |
|---|---|---|---|
| 0 | Snapshot | `../logistics-tick.ts` | Baut `LogisticsTickContext` mit `poweredSet` + lazy "newXxxL" working sets (inkl. `newAutoSmeltersL`, `newAutoAssemblersL`). |
| 1 | Auto-Miner | [`phases/auto-miner.ts`](./phases/auto-miner.ts) | Produktion + Output-Routing der Auto-Miner. |
| 2 | Conveyor | [`phases/conveyor.ts`](./phases/conveyor.ts) | Conveyor-Movement, Transport-Matching, Destination-Handoff. |
| 3 | Auto-Smelter | [`phases/auto-smelter.ts`](./phases/auto-smelter.ts) | Belt-Input-Pull → Verarbeitung → Output-Flush → Status-Update. |
| 4 | Auto-Assembler | [`phases/auto-assembler.ts`](./phases/auto-assembler.ts) | Belt-only Input-Pull (`ironIngotBuffer`) → Verarbeitung mit V1-Festrezepten → belt-only Output-Flush → Status-Update. |
| 5 | Commit | `../logistics-tick.ts` | Mergt working sets zurück in `GameState` (No-Op falls `ctx.changed === false`). |

Die Reihenfolge entspricht 1:1 der Aufrufkette in `handleLogisticsTickAction`: nach `runAutoSmelterPhase` läuft zusätzlich `runAutoAssemblerPhase(ctx)`. Reihenfolge **nicht** umstellen ohne Conveyor↔Smelter↔Assembler-Review (siehe unten).

---

## Phase-3 Schreibpfade (Auto-Smelter)

`runAutoSmelterPhase(ctx)` schreibt — über das `ctx.newXxxL`-Working-Set, committed erst in Phase 5 — in:

- **`state.autoSmelters[smelterId]`** (immer der Hauptkandidat):
  - `status`: `"NO_POWER" | "MISCONFIGURED" | "PROCESSING" | "OUTPUT_BLOCKED" | "IDLE"` (vollständige Liste; Quelle: `decideAutoSmelterNonPendingStatus` und `decideAutoSmelterPendingOutputStatus` in [`smelter-decisions.ts`](../../decisions/smelter-decisions.ts))
  - `processing` (start/progress/finish-Übergang); `durationMs` über `getAutoSmelterTickInterval(base, equippedModule)`, `progressMs` pro Tick um `LOGISTICS_TICK_MS * getBoostMultiplier(asset)` erhöht
  - `inputBuffer` (Pull genau 1 passendes Item pro Tick vom Input-Conveyor, hart gecappt auf `AUTO_SMELTER_BUFFER_CAPACITY` aus [`constants/auto/auto-smelter.ts`](../../constants/auto/auto-smelter.ts); beim Batch-Start werden `recipe.inputAmount` zum gewählten Rezept passende Items entfernt — andere, nicht passende Items bleiben im Buffer)
  - `pendingOutput` (Output-Queue; geleert beim Flush)
  - `lastRecipeInput` / `lastRecipeOutput` (für UI)
  - `throughputEvents` (60-s-Sliding-Window; Append per `consumeAutoSmelterPendingOutput({ recordThroughputEvent: true })` ausschließlich bei erfolgreichem Output-Flush auf Conveyor oder Source-Inventar; bei `no_target`-Konsum wird **kein** Event geschrieben; Trim jeden Tick gegen `Date.now() - 60_000`)
- **`state.conveyors[*]`**:
  - **Pull** vom Input-Conveyor an `smelterIo.input` (entfernt 1 Item aus `queue`)
  - **Push** auf Output-Conveyor an `smelterIo.output` (append, respektiert `CONVEYOR_TILE_CAPACITY`)
- **Source-Inventar** (nur wenn Output-Conveyor blockiert/abwesend und Source erlaubt Fallback) via `applySourceInventory(ctx, source, …)`:
  - delegiert an `applyCraftingSourceInventory(...)` und schreibt damit in `state.inventory` und/oder einen oder mehrere Einträge von `state.warehouseInventories`
  - Zone-Sources besitzen kein eigenes State-Feld — sie werden auf die Warehouse-Inventories der Zone aggregiert (siehe `resolveBuildingSource` und [`crafting/crafting-sources.ts`](../../../crafting/crafting-sources.ts))

`ctx.changed = true` muss bei jeder beobachtbaren Mutation gesetzt werden, sonst wird der Phase-5-Commit übersprungen.

---

## Phase-4 Schreibpfade (Auto-Assembler)

`runAutoAssemblerPhase(ctx)` ist strikt belt-only (kein Inventar-Fallback weder für Input noch für Output). Schreibt in:

- **`state.autoAssemblers[assemblerId]`**:
  - `status`: `"NO_POWER" | "MISCONFIGURED" | "PROCESSING" | "OUTPUT_BLOCKED" | "IDLE"` (Pending-Output-Status werden direkt in [`phases/auto-assembler.ts`](./phases/auto-assembler.ts) aus `decideAssemblerBeltOnlyOutput` abgeleitet, Non-Pending-Status über `decideAutoSmelterNonPendingStatus`)
  - `processing` (start/progress/finish-Übergang; `durationMs = recipe.processingTimeSec * 1000`, `progressMs += LOGISTICS_TICK_MS` ohne Boost-Multiplikator — V1 hat kein Overclocking)
  - `ironIngotBuffer` (numerischer Counter, kein Array; Pull 1 `ironIngot` pro Tick vom Input-Conveyor, hart gecappt auf `AUTO_ASSEMBLER_BUFFER_CAPACITY` aus [`constants/auto/auto-assembler.ts`](../../constants/auto/auto-assembler.ts); beim Batch-Start um `recipe.inputAmount` reduziert)
  - `pendingOutput` (Output-Queue; geleert beim belt-only Flush)
- **`state.conveyors[*]`**:
  - **Pull** vom Input-Conveyor am Input-Tile von `getAutoSmelterIoCells(asset)` (entfernt 1 `ironIngot` aus `queue`, sofern Front-Item passt und Buffer-Kapazität gegeben)
  - **Push** auf Output-Conveyor am Output-Tile (append, respektiert `CONVEYOR_TILE_CAPACITY`); bei vollem Output-Conveyor wird `OUTPUT_BLOCKED`, bei nicht-existierendem/falschem Output-Tile `MISCONFIGURED` gesetzt
- **Rezepte**: aus [`AutoAssemblerV1Recipes`](../../../simulation/recipes/AutoAssemblerV1Recipes.ts) via `getAutoAssemblerV1Recipe(selectedRecipe)` — fester V1-Satz, kein Recipe-Wechsel innerhalb dieser Phase.

Auch hier muss `ctx.changed = true` bei jeder beobachtbaren Mutation gesetzt werden.

---

## Underpower-Semantik (Smelter & Miner & Assembler)

- `getMachinePowerRatio(ctx, assetId)` liefert ein Float-Verhältnis aus `state.machinePowerRatio` (Fallback: `1` falls in `poweredSet`, sonst `0`).
- **Jedes `ratio < 1` ist ein vollständiger Stopp**, kein partielles Slowdown:
  - **Auto-Miner** ([`phases/auto-miner.ts`](./phases/auto-miner.ts)): `decideAutoMinerTickEligibility` blockt; `progress` bleibt eingefroren.
  - **Auto-Smelter** ([`phases/auto-smelter.ts`](./phases/auto-smelter.ts)): `processing.progressMs` bleibt unverändert, `status` wird auf `"NO_POWER"` gesetzt, `continue` überspringt den Rest der Iteration.
  - **Auto-Assembler** ([`phases/auto-assembler.ts`](./phases/auto-assembler.ts)): identische Semantik — `processing.progressMs` bleibt eingefroren, `status` wird auf `"NO_POWER"` gesetzt.
- Sobald wieder volle Versorgung anliegt, läuft die Verarbeitung mit dem zuvor erreichten `progressMs` weiter (kein Reset).

---

## Module- & Boost-System

- **Auto-Miner**:
  - `getEquippedModule(state, minerId)` → `getAutoMinerOutputAmount(equippedModule)` skaliert die Anzahl der pro Produktionszyklus erzeugten Items.
  - `getBoostMultiplier(minerAsset)` wird auf `progress` addiert (`progress += minerBoost`), beschleunigt also den Abstand zwischen Produktionszyklen.
- **Auto-Smelter**:
  - `getEquippedModule(state, smelterId)` fließt in `getAutoSmelterTickInterval(baseDurationMs, equippedModule)` und skaliert damit `processing.durationMs`.
  - `getBoostMultiplier(smelterAsset)` multipliziert den pro-Tick-Fortschritt: `progressMs += LOGISTICS_TICK_MS * smelterBoost`.
- **Auto-Assembler (V1)**: kein Overclocking, kein Boost-Multiplikator, keine Modul-Skalierung — `durationMs` ist fest aus der Rezeptdefinition, `progressMs += LOGISTICS_TICK_MS`.

Helper-Quellen: [`helpers/machine-priority.ts`](../../helpers/machine-priority.ts) (`getBoostMultiplier`), [`selectors/module-selectors.ts`](../../selectors/module-selectors.ts) (`getEquippedModule`).

---

## Reihenfolge-Risiken

- **Conveyor vor Smelter/Assembler** ist beabsichtigt: Phase 2 verschiebt Items entlang der Belts; Phase 3 und 4 ziehen das frisch eingelaufene Item am jeweiligen Input-Tile. Würde man Phase 3/4 vor Phase 2 ausführen, lägen Items am Input-Tile einen Tick zu früh "alt" / einen Tick zu spät "neu" — Throughput-Bug.
- **Auto-Miner vor Conveyor** ist beabsichtigt: Auto-Miner platzieren neue Items auf ihrem Output-Tile; Phase 2 kann sie sofort weitertransportieren.
- Smelter- und Assembler-Output-Routing prüfen den Output-Conveyor in derselben Phase, in der dieser bereits per Phase 2 bewegt wurde — Output kann also direkt an einer freien Tile-Stelle landen.
- **Auto-Assembler nach Auto-Smelter**: Smelter-Output (z. B. `ironIngot`) liegt am Ende von Phase 3 ggf. auf einer Belt-Tile, die in derselben `LOGISTICS_TICK` nicht mehr bewegt wird; ein nachgelagerter Assembler kann das Item also frühestens im **nächsten** Tick aufnehmen. Reihenfolge **nicht** umstellen, ohne Tests in [`store/__tests__/auto-smelter-conveyor-input.test.ts`](../../__tests__/auto-smelter-conveyor-input.test.ts) und Logistics-Tick-Tests durchzuspielen.

---

## Was diese Phasenkette **nicht** tut

- Kein Crafting-Job-Lifecycle (`JOB_TICK` ist separat — siehe [`crafting/README.md`](../../../crafting/README.md)).
- Keine neuen Crafting-Jobs enqueuen (Architekturregel — Smelter und Assembler sind beide Execution-Side).
- Keine direkten `network`-Reservierungen (Smelter nutzt `getCraftingSourceInventory`/`applySourceInventory` ohne den Reservation-Layer; Assembler nutzt überhaupt kein Source-Inventar).
- Kein Asset-Placement (`assets`/`cellMap` werden hier nicht verändert, sondern nur gelesen).

---

## Verwandt

- Smelter-Recipes (`processingTime`, `inputItem`, `inputAmount`, `outputItem`): [`simulation/recipes/SmeltingRecipes.ts`](../../../simulation/recipes/SmeltingRecipes.ts).
- Assembler-V1-Recipes (`inputAmount`, `outputItem`, `processingTimeSec`): [`simulation/recipes/AutoAssemblerV1Recipes.ts`](../../../simulation/recipes/AutoAssemblerV1Recipes.ts).
- IO-Geometrie (Input-/Output-Tile pro Smelter **und** Assembler): [`asset-geometry.ts`](../../asset-geometry.ts) → `getAutoSmelterIoCells` (wird von beiden Phasen wiederverwendet).
- Boost-Multiplikator: [`helpers/machine-priority.ts`](../../helpers/machine-priority.ts) → `getBoostMultiplier`.
- Equipped-Module-Lookup: [`selectors/module-selectors.ts`](../../selectors/module-selectors.ts) → `getEquippedModule`.
- Source-Inventar-Schreibpfad: [`crafting/crafting-sources.ts`](../../../crafting/crafting-sources.ts) → `applyCraftingSourceInventory`.
