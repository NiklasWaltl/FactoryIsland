# TROUBLESHOOTING.md — Factory Island

Common errors, causes, and solutions for development and build.

---

## 1. Build & TypeScript

### `tsc` fails during `yarn build`

| Cause                              | Solution                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Path alias missing                 | Factory Island uses only relative imports within `src/game/`. Only alias: `game/*`.           |
| Type missing in `store/reducer.ts` | New types must be defined in `store/reducer.ts` and re-exported in `types/game.ts` if needed. |
| `tsconfig.factory.json` not used   | Check: `tsc --project tsconfig.factory.json` (not `tsconfig.json`).                           |
| Missing `vite/client` types        | `tsconfig.factory.json` must contain `"types": ["vite/client"]`.                              |

### Import error: `Cannot find module 'features/...'`

Factory Island has only the path alias `game/*` → `src/game/*`.

- ❌ `import { something } from "features/game"` — does not exist
- ✅ `import { something } from "../store/reducer"` — relative import

### Import error: recipes imported directly

```
// ❌ Fehler: Rezepte nur via Barrel importieren
import { getSmeltingRecipe } from "./recipes/SmeltingRecipes";

// ✅ Korrekt
import { getSmeltingRecipe } from "./recipes";
```

---

## 2. Dev Server

### `yarn dev` does not start

| Checkpoint                | Action                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| Port occupied             | Port 3000 is used (`server.port: 3000`). Stop the other process. |
| `node_modules` missing    | Run `yarn install`.                                              |
| Vite version incompatible | `vite@^5.4.21` is required (see `package.json`).                 |

### HMR does not work / state is lost

- HMR state is saved via `window.__FI_HMR_STATE__` (DEV mode only).
- If HMR does not apply: check the browser console for `[HMR]` messages.
- Workaround: manually reload the page (F5). Debug mode starts with the complete test setup.

### Phaser canvas stays black / is missing

- `PhaserHost.tsx` mounts the canvas in `Grid.tsx`. Check whether `PhaserHost` is rendered.
- Phaser sprites must be loaded in `PhaserGame.ts` `preload()` — missing sprites log errors in the console.
- Canvas has `pointer-events: none` — this is correct; clicks go through React.

---

## 3. White Screen / App does not load

### Checklist

1. **Open browser console** (F12) → read the error message.
2. **Check GameErrorBoundary**: for render errors, the error boundary catches the crash and shows "Something went wrong" with a "Try again" button (deletes the localStorage save + remounts the app). If instead there is a blank page without text → check for a JavaScript error before React mount (e.g. in `main.factory.tsx`).
3. **Check entry point**: `index.factory.html` must point to `/src/game/entry/main.factory.tsx`.
4. **Reducer error**: unhandled action types in the reducer do not throw an error, but can lead to unexpected state.
5. **Corrupt save**: if `localStorage` contains an invalid save:
   - Console: `localStorage.removeItem("factory-island-save")` → reload page.
   - Alternative: Application tab → Local Storage → delete entry.
6. **Missing fields in GameState**: if new fields were added but `save.ts` was not migrated → crash when loading old saves (see section 4).

---

## 4. Save/Load Issues

### Old save crashes after code change

**Cause**: New fields in `GameState` without a corresponding migration under `src/game/simulation/migrations/`.

**Solution**:

1. Increment `CURRENT_SAVE_VERSION` in [`src/game/simulation/migrations/types.ts`](src/game/simulation/migrations/types.ts).
2. Define new interface `SaveGameV{N}` and point the `SaveGameLatest` alias to it (same file).
3. Write migration function `migrateV{N-1}ToV{N}()` in the relevant bucket (`v21-v30.ts`) or in its own `migrations/v{N}.ts` (pattern: `v31.ts`, `v32.ts`).
4. Add an import + `step(N-1, N, migrateV{N-1}ToV{N})` entry to the `MIGRATIONS` array in [`migrations/index.ts`](src/game/simulation/migrations/index.ts).
5. Update the whitelist in `serializeState` and the hydrate in `deserializeState` ([save-codec.ts](src/game/simulation/save-codec.ts)). See `simulation/README.md` for the full runbook.

**Quick workaround** (development only):

```javascript
// Browser-Konsole
localStorage.removeItem("factory-island-save");
```

### Save is ignored on load (empty state after refresh)

**Cause**: `loadAndHydrate(raw, mode)` loads only when `save.mode === mode`. A debug save is not loaded in release mode and vice versa.

**Solution**: On restart, choose the same mode (debug/release) as when the game was last saved.

### Save contains derived state

`serializeState()` persists only core fields. Transient fields are reset during load:

- `connectedAssetIds` → `computeConnectedAssetIds()` (immediately in `deserializeState`)
- `poweredMachineIds` → next `ENERGY_NET_TICK`
- `openPanel`, `notifications`, `buildMode` → defaults
- `autoDeliveryLog`, `energyDebugOverlay` → empty / false

If a new field should be transient: do **not** include it in `SaveGameV*`; initialize it with a default in `deserializeState()` instead.

---

## 5. Energy Network Issues

### Machine receives no power

| Checkpoint                            | Detail                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Generator placed?                     | Must stand on stone floor (`REQUIRES_STONE_FLOOR`).                                                                                      |
| Generator has fuel?                   | Add wood + start.                                                                                                                        |
| Cable connection?                     | Only `cable`, `generator`, `power_pole` are cable conductors (phase-1 BFS). Machines and batteries do not conduct energy through cables. |
| Power Pole in range?                  | Chebyshev distance ≤ 3 tiles (`POWER_POLE_RANGE`). Machine must be within range of a pole connected via cable.                           |
| Machine registered in `ENERGY_DRAIN`? | New machines must be registered there.                                                                                                   |
| Priority too low?                     | `MachinePriority` 5 = lowest. During shortage, lower priorities are throttled.                                                           |
| Auto-Smelter draws too much?          | In processing state, 60 J/period (instead of 10 J idle). Plan sufficient generator capacity for full operation.                          |

### Debug: visualize energy network

In debug mode: `TOGGLE_ENERGY_DEBUG` action or UI button → `EnergyDebugOverlay` shows network topology.

---

## 6. Conveyor / Logistics

### Conveyor is ignored during Logistics-Tick

**Cause**: `conveyors[id]` was not initialized when placed.

**Solution**: When placing a conveyor, the reducer must set `conveyors[id] = { queue: [] }`.

### Items back up / machine shows OUTPUT_BLOCKED

- Output tile has maximum capacity: `CONVEYOR_TILE_CAPACITY = 4`.
- Machine waits until space is free on the output conveyor.
- Check: is the next conveyor aligned correctly (`direction`)?

### Warehouse accepts no items

The warehouse input is **direction-dependent** — depending on `warehouse.direction`:

| warehouse.direction | Input Position    | Conveyor must point |
| ------------------- | ----------------- | ------------------- |
| `"south"` (Default) | `(x, y + height)` | `"north"`           |
| `"north"`           | `(x, y - 1)`      | `"south"`           |
| `"east"`            | `(x + width, y)`  | `"west"`            |
| `"west"`            | `(x - 1, y)`      | `"east"`            |

Validation: `isValidWarehouseInput(entityX, entityY, entityDir, warehouse)` from `store/reducer`.

---

## 7. Asset Placement

### Building cannot be placed

| Checkpoint                 | Detail                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| Collision?                 | `placeAsset()` checks for overlapping assets.                                |
| Wrong floor?               | Generator requires stone floor.                                              |
| Auto-Miner not on deposit? | Must stand directly on `stone_deposit`, `iron_deposit`, or `copper_deposit`. |
| Direction not set?         | Default is `"east"`. R key to switch.                                        |

### Size bugs for rotatable machines

`PlacedAsset` has `size`, `width`, and `height`. `assetWidth`/`assetHeight` are **internal functions** in `reducer.ts` — not exported. Outside `reducer.ts`, use directly:

```typescript
// ✅ Korrekt
const w = asset.width ?? asset.size;
const h = asset.height ?? asset.size;

// ❌ Falsch — asset.size ignoriert width/height-Override
const w = asset.size;
```

Auto-Smelter: `size=2, width=2, height=1` — with `asset.size` alone, the height would be wrong.

---

## 8. Phaser / Sprites

### Sprite is not displayed

1. Check whether the sprite is defined in `assets/sprites/sprites.ts` (`ASSET_SPRITES`).
2. Check whether `PhaserGame.ts` `preload()` loads the sprite key.
3. Check the browser console for 404 errors for sprite URLs.

### Phaser world and React UI are offset

- Both must use the same transform basis (`Grid.tsx`).
- Do not create a second camera or offset logic.
- `PhaserHost` sits inside the world container in `Grid.tsx`.

---

## 9. Debug Mode

### Debug panel does not appear

- Visible only when `IS_DEV = true` (Vite DEV build) AND `state.mode === "debug"`.
- In production, everything is tree-shaken via `import.meta.env.DEV`.
- On startup, choose "debug" via `ModeSelect.tsx`.

### Debug logs do not appear in the console

Debug logger checks **two conditions**:

1. `import.meta.env.DEV` — must be true (DEV build, not production)
2. `isDebugEnabled()` — runtime toggle, can be disabled from debug UI

Both must be true. Reset runtime toggle: `import { setDebugEnabled } from "./debug/debugConfig"; setDebugEnabled(true)` in the browser console (requires DEV build).

### Mock data has no effect

- Mock actions (`DEBUG_MOCK_RESOURCES` etc.) are processed via `applyMockToState()`.
- Available only in debug mode (guard: `IS_DEV`).
- Result is dispatched as a `DEBUG_SET_STATE` action.

---

## 10. Quick Checklist

| Problem                        | First Action                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build fails                    | Run `tsc --project tsconfig.factory.json` separately → read error message                                                                                                                                    |
| White Screen (blank)           | Browser console (F12) → check JS error                                                                                                                                                                       |
| White Screen with text         | GameErrorBoundary caught error — "Try again" or manually delete save                                                                                                                                         |
| Old save crashes               | `localStorage.removeItem("factory-island-save")`                                                                                                                                                             |
| Save is ignored                | Mode mismatch? Debug save is not loaded in release mode                                                                                                                                                      |
| Machine without power          | Enable energy network debug overlay; check cable conductors (only cable/generator/power_pole)                                                                                                                |
| Auto-Smelter without power     | Account for high drain (60 J/period processing) — more generator capacity                                                                                                                                    |
| Conveyor ignored               | Check `conveyors[id]` in reducer case                                                                                                                                                                        |
| Warehouse accepts nothing      | Direction-dependent input: check `getWarehouseInputCell()`                                                                                                                                                   |
| Sprite missing                 | Check `ASSET_SPRITES` in `sprites.ts` + `preload()` in `PhaserGame.ts`                                                                                                                                       |
| HMR state lost                 | Reload page — debug mode starts with test setup                                                                                                                                                              |
| Import error                   | Only relative imports in `src/game/`, only alias: `game/*`                                                                                                                                                   |
| New field crashes saves        | Add migration under `src/game/simulation/migrations/`, increment `CURRENT_SAVE_VERSION` in `migrations/types.ts`, register the step in `migrations/index.ts`, and extend `serializeState`/`deserializeState` |
| Panel shows nothing            | Check whether panel is mounted in `GameInner` (FactoryApp.tsx) and `UIPanel` union is extended                                                                                                               |
| assetWidth/assetHeight missing | Not exported — use `asset.width ?? asset.size` directly                                                                                                                                                      |
| Debug logs missing             | Check both conditions: `import.meta.env.DEV` AND `isDebugEnabled()`                                                                                                                                          |

---

_Last updated: 2026-04-17 — Maintenance note: When new error patterns or build changes appear, extend this file. No duplication with `ARCHITECTURE.md` — structure belongs there, troubleshooting belongs here._
