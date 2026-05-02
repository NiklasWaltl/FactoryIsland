import type { FragmentTier, ModuleFragment } from "../types";

export const MODULE_FRAGMENT_TIERS: readonly FragmentTier[] = [1, 2, 3];

export function createDefaultModuleFragments(): ModuleFragment[] {
  return MODULE_FRAGMENT_TIERS.map((tier) => ({ tier, count: 0 }));
}

export function isFragmentTier(value: unknown): value is FragmentTier {
  return value === 1 || value === 2 || value === 3;
}

export function normalizeModuleFragments(raw: unknown): ModuleFragment[] {
  const counts = new Map<FragmentTier, number>();

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const tier = (entry as Partial<ModuleFragment>).tier;
      if (!isFragmentTier(tier)) continue;
      counts.set(
        tier,
        normalizeFragmentCount((entry as Partial<ModuleFragment>).count),
      );
    }
  }

  return MODULE_FRAGMENT_TIERS.map((tier) => ({
    tier,
    count: counts.get(tier) ?? 0,
  }));
}

export function addModuleFragmentCount(
  fragments: unknown,
  tier: FragmentTier,
  amount = 1,
): ModuleFragment[] {
  const increment = normalizeFragmentCount(amount);
  const normalized = normalizeModuleFragments(fragments);
  if (increment === 0) return normalized;

  return normalized.map((entry) =>
    entry.tier === tier
      ? { ...entry, count: entry.count + increment }
      : entry,
  );
}

function normalizeFragmentCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}
