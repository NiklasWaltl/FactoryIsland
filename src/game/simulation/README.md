# `simulation/` — Save/Load Pipeline

> Persistence- und Migrations-Layer. Diese README ist ein **Runbook**
> für den häufigsten gefährlichen Flow: ein neues Feld in den
> persistierten `GameState` aufnehmen.

---

## Pipeline-Überblick

```
GameState (runtime)
   │
   │ serializeState()  ← WHITELIST in save-codec.ts
   ▼
SaveGameLatest  ──►  JSON.stringify  ──►  localStorage[SAVE_KEY]
                                              (alle 10 s + beforeunload)

localStorage[SAVE_KEY]  ──►  JSON.parse  ──►  unknown
   │
   │ migrateSave()  ← Kette migrateV0ToV1 … migrateV30ToV31 … migrateV31ToV32
   ▼
SaveGameLatest
   │
   │ deserializeState()  ← derives runtime-only fields
   │     + sanitizeXxx()  ← save-normalizer.ts
   ▼
GameState (runtime, hydratiert)
```

`deserializeState` endet mit `applyDockWarehouseLayout(partial)` zur Sicherung der Dock-/Ship-Layout-Kompatibilität.

**Parallelpfad HMR (DEV only):** `saveHmrState`/`loadHmrState` ([`debug/hmrState.ts`](../debug/hmrState.ts)) speichert Live-State und lädt ihn beim Hot-Reload. Beide Pfade (HMR und localStorage) gehen durch `normalizeLoadedState` in [`entry/FactoryApp.tsx`](../entry/FactoryApp.tsx) → das wiederum ruft `migrateSave` + `deserializeState`.

---

## Modulkarte

| Datei                                        | Zweck                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`save.ts`](./save.ts)                       | Stabile Top-Level Public-API-Fassade fuer Save/Load-Imports.                                                                                                                                                                                                                                                                                                                                |
| [`save-codec.ts`](./save-codec.ts)           | `serializeState` (Whitelist!) + `deserializeState` (re-derive runtime-only fields) + `loadAndHydrate` (one-stop Helper: parse → migrate → hydrate).                                                                                                                                                                                                                                         |
| [`save-migrations.ts`](./save-migrations.ts) | Re-export-Fassade fuer die Migrations: exportiert `CURRENT_SAVE_VERSION` (aktuell: **32**, definiert in [`migrations/types.ts`](./migrations/types.ts)), alle `SaveGameVN`-Interfaces (V1–V32) und `migrateSave`/`clampGeneratorFuel`. Die eigentliche Chain (V0 → V32) liegt in [`migrations/`](./migrations/) (`v01-v10.ts`, `v11-v20.ts`, `v21-v30.ts`, `v31.ts`, `v32.ts`, `index.ts`). |
| [`save-normalizer.ts`](./save-normalizer.ts) | `sanitizeXxx`-Funktionen: `sanitizeNetworkSlice`, `sanitizeCraftingQueue`, `sanitizeStarterDrone`, `sanitizeConveyorUndergroundPeers`, `sanitizeKeepStockByWorkbench`, `sanitizeRecipeAutomationPolicies` + `rebuildGlobalInventoryFromStorage` (re-derives `globalInventory` aus warehouse/hub-Slices).                                                                                    |
| [`save-legacy.ts`](./save-legacy.ts)         | V0 (pre-versioned) → V1 Sonderfall + Runtime-Snapshot-Detection.                                                                                                                                                                                                                                                                                                                            |
| [`recipes/`](./recipes/)                     | Statische Recipe-Definitionen (Workbench / Smelting / ManualAssembler / AutoAssemblerV1). Nicht persistenz-relevant.                                                                                                                                                                                                                                                                        |
| [`game.ts`](./game.ts)                       | Legacy-Compatibility-Shim (`export * from "../store/reducer"`); aktuell ohne interne Konsumenten in `src/**`.                                                                                                                                                                                                                                                                               |
| [`mining-utils.ts`](./mining-utils.ts)       | Hilfsfunktionen für Auto-Miner-Tick (Yield-Multiplikator, etc.).                                                                                                                                                                                                                                                                                                                            |
| [`smelting-utils.ts`](./smelting-utils.ts)   | Hilfsfunktionen für Auto-Smelter-Tick (Speed-Multiplikator, Tick-Intervall, etc.).                                                                                                                                                                                                                                                                                                          |
| [`__tests__/`](./__tests__/)                 | Roundtrip-, Migrations- und Simulation-Unit-Tests.                                                                                                                                                                                                                                                                                                                                          |

**API-Grenze:** Neue Konsumenten sollten aus [`save.ts`](./save.ts) importieren. Direkte Importe aus [`save-codec.ts`](./save-codec.ts), [`save-migrations.ts`](./save-migrations.ts) oder [`save-normalizer.ts`](./save-normalizer.ts) sind primär fuer interne Implementierung und gezielte Tests gedacht.

---

## Runbook: Neues persistiertes Feld hinzufügen

Beispiel: `state.fooBar: Record<string, number>` soll persistiert werden.

### Schritt 1 — Type erweitern

[`../store/types.ts`](../store/types.ts): Feld in `GameState` ergänzen.

### Schritt 2 — Default in initial-state

[`../store/initial-state.ts`](../store/initial-state.ts): `fooBar: {}` (oder sinnvoller Default) in `createInitialState` setzen.
**Wichtig:** Auch bestehende Saves greifen indirekt darauf zu (`deserializeState` startet von `createInitialState(save.mode)`).

### Schritt 3 — Save-Schema-Versionsbump

Die Migrations sind seit dem V31-Schritt in [`migrations/`](./migrations/) aufgesplittet. [`save-migrations.ts`](./save-migrations.ts) ist nur noch der Re-Export-Shim.

1. Neues Interface `SaveGameV<N+1>` in [`migrations/types.ts`](./migrations/types.ts) — Copy aus `SaveGameV<N>` + neues Feld.
2. `type SaveGameLatest = SaveGameV<N+1>` in derselben Datei aktualisieren.
3. `CURRENT_SAVE_VERSION` in [`migrations/types.ts`](./migrations/types.ts) von `N` → `N+1` bumpen.
4. Neue Migrations-Funktion `migrateV<N>ToV<N+1>(save: SaveGameV<N>): SaveGameV<N+1>` anlegen — entweder in der zustaendigen Bucket-Datei (`v21-v30.ts`) oder, fuer Einzel-Schritte ab V30, in einer eigenen `migrations/v<N+1>.ts` (Muster: [`v31.ts`](./migrations/v31.ts), [`v32.ts`](./migrations/v32.ts)). Typischer Inhalt: `{ ...save, version: N+1, fooBar: {} }`.
5. In [`migrations/index.ts`](./migrations/index.ts) den neuen Import ergaenzen und einen `step(N, N+1, migrateV<N>ToV<N+1>)`-Eintrag an die `MIGRATIONS`-Liste anhaengen.

> **Aktueller Stand:** `CURRENT_SAVE_VERSION = 32` (V32). Nächste Migration wäre V32→V33.

### Schritt 4 — Whitelist im Codec

[`save-codec.ts`](./save-codec.ts) → `serializeState`: Feld in den zurückgegebenen Object-Literal aufnehmen. **Ohne diesen Schritt wird das Feld nie gespeichert**, egal was im Type steht.

### Schritt 5 — Hydrate

[`save-codec.ts`](./save-codec.ts) → `deserializeState`: Feld aus `save.fooBar` ins `partial: GameState` übernehmen. Bei optionalen Feldern Fallback auf `base.fooBar`.

### Schritt 6 — (optional) Sanitizer

Wenn das Feld inhaltliche Invarianten hat (z. B. Foreign Keys auf andere `state`-Slices, die bereits sanitized werden): Sanitizer in [`save-normalizer.ts`](./save-normalizer.ts) ergänzen und in `deserializeState` aufrufen.

### Schritt 7 — Tests

- Roundtrip: `serializeState(state) → migrateSave → deserializeState` muss `fooBar` erhalten.
- Migrations-Test: Ein V<N>-Save (ohne `fooBar`) muss durch `migrateV<N>ToV<N+1>` einen sinnvollen Default bekommen.
- DEV-Invarianten in [`../store/reducer.ts`](../store/reducer.ts) `gameReducerWithInvariants` (z. B. `devAssertInventoryNonNegative`) prüfen, falls das neue Feld inventarähnlich ist.

### Schritt 8 — Konsumenten

- UI-Komponenten, die `state.fooBar` lesen, ergänzen.
- `DEBUG_SET_STATE` (siehe [`../store/action-handlers/maintenance-actions/`](../store/action-handlers/maintenance-actions/)) umgeht Invarianten — beim Schreiben von Test-Fixtures auch den neuen Default mitliefern.

---

## Stolperfallen

- **Whitelist-Codec:** `serializeState` ist eine harte Whitelist. Ein Feld nur in `GameState` zu deklarieren bewirkt **nichts** für Persistenz.
- **HMR-Path geht ebenfalls durch Migration:** Wer den Versionsbump vergisst, bekommt im DEV nach Hot-Reload eine "alte" Save-Version → Migration läuft → Feld könnte zurückgesetzt werden.
- **`deserializeState` startet von `createInitialState`:** Fehlt der Default dort, ist der hydratisierte State für _neue_ Spielstände inkonsistent mit migrated-Saves.
- **`autoDeliveryLog`, `notifications`, `openPanel`, `selected*Id` sind absichtlich NICHT persistiert** — UI-transient. Nicht in `serializeState` aufnehmen, sonst überschreibt Save den UI-State.
- **`connectedAssetIds`** wird beim Hydraten neu berechnet; **`poweredMachineIds`** wird beim Laden auf ein leeres Array zurückgesetzt und erst im `ENERGY_NET_TICK` neu aufgebaut.
- **`drones[id]`** ist der einzige kanonische Speicherort für Drohnen. Das frühere Parallelfeld `starterDrone` wurde mit Migration v29→v30 entfernt. `deserializeState` sanitisiert Drohneneinträge über `sanitizeStarterDrone` — neue Drone-Felder dort ergänzen.
- **`unlockedBuildings`-Drift im Code-Pfad:** v31 ergaenzt das Feld fuer Legacy-Saves, v32 fuegt `research_lab` idempotent an. Wer einen weiteren Default-Unlock dazustellt, muss sowohl `TIER_0_UNLOCKED_BUILDINGS` (fuer Frischstart) als auch eine neue idempotente Migration einplanen — sonst sehen geladene Saves den neuen Eintrag nicht.

---

## Verwandt

- `ARCHITECTURE.md` "Known Friction" Punkt 1 (`GameAction` standalone in `store/game-actions.ts`).
- `ARCHITECTURE.md` State Map "Persistiert"-Spalte als Wahrheitsquelle, _welche_ Slices durch diese Pipeline gehen.
- DEV-Invarianten: [`../store/reducer.ts`](../store/reducer.ts) `gameReducerWithInvariants`.
