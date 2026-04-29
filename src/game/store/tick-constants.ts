// ============================================================
// Tick interval constants — aggregated re-export.
// ------------------------------------------------------------
// Canonical definitions live in the individual files below.
// This module exists solely to give FactoryApp.tsx a single
// import point for all *_MS timer values, without coupling
// it to the full reducer barrel.
//
// reducer.ts continues to re-export all of these via its own
// `export *` lines — no backward compatibility is broken.
// ============================================================

export {
  NATURAL_SPAWN_MS,
  LOGISTICS_TICK_MS,
  CRAFTING_TICK_MS,
  DRONE_TICK_MS,
} from "./constants/timing";

export {
  SMITHY_TICK_MS,
  MANUAL_ASSEMBLER_TICK_MS,
} from "./constants/workbench-timing";

export { GENERATOR_TICK_MS } from "./constants/energy/generator";

export { ENERGY_NET_TICK_MS } from "./constants/energy/energy-smelter";
