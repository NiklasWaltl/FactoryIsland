// ============================================================
// Factory Island - Debug Configuration
// ============================================================
// Tree-shaken in production: all checks use import.meta.env.DEV
// which Vite statically replaces with `false` in production builds,
// allowing dead-code elimination.

/** True only in Vite dev mode (stripped in production) */
export const IS_DEV = import.meta.env.DEV;

/** Runtime flag – toggleable from Debug UI */
let _debugEnabled = IS_DEV;

export function isDebugEnabled(): boolean {
  return _debugEnabled && IS_DEV;
}

export function setDebugEnabled(v: boolean): void {
  if (!IS_DEV) return;
  _debugEnabled = v;
}

/**
 * DEV-only auto-unlock for buildings in DEV scenes.
 * When enabled (default), the DEV scene builder unlocks every building so
 * the developer doesn't need to research them. When disabled, the scene
 * builder leaves `unlockedBuildings` at the base-state value, which lets
 * the normal Research-Lab workflow be tested in DEV.
 *
 * Effect is applied at scene-build time (next DEV reset / scene reload),
 * not live in the running state.
 */
let _devAutoUnlockBuildings = true;

export function isDevAutoUnlockBuildingsEnabled(): boolean {
  return _devAutoUnlockBuildings && IS_DEV;
}

export function setDevAutoUnlockBuildingsEnabled(v: boolean): void {
  if (!IS_DEV) return;
  _devAutoUnlockBuildings = v;
}
