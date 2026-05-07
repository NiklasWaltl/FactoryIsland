// Module-scoped id counter shared across all callers. Extracted from
// reducer.ts so handler modules can value-import `makeId` directly
// without creating an ESM cycle through `../reducer`.

let counter = 0;

/** Returns a unique string id with the given prefix (default "a"). */
export function makeId(prefix: string = "a"): string {
  return `${prefix}${Date.now()}_${counter++}`;
}

/** Returns a collision-resistant module id using injected clock and rng. */
export function makeModuleId(
  prefix: string,
  now: number,
  rand: () => number,
): string {
  return `${prefix}-${now.toString(36)}-${rand().toString(36).slice(2, 8)}`;
}
