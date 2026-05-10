import type { GeneratorState, StarterDroneState } from "../../store/types";
import type { ShipQuest, ShipState } from "../../store/types/ship-types";
import { SHIP_QUEST_HISTORY_SIZE } from "../../ship/quest-registry";
import { GENERATOR_MAX_FUEL } from "../../store/constants/buildings/index";
import { debugLog } from "../../debug/debugLogger";
import { STARTER_DRONE_ID } from "../../store/selectors/drone-selectors";
import type { MigrationStep } from "./types";

/**
 * Clamp each generator's local fuel buffer to GENERATOR_MAX_FUEL.
 * Pure and idempotent; applied on load.
 */
export function clampGeneratorFuel(
  generators: Record<string, GeneratorState>,
): Record<string, GeneratorState> {
  const out: Record<string, GeneratorState> = {};
  for (const [id, g] of Object.entries(generators)) {
    out[id] =
      g.fuel > GENERATOR_MAX_FUEL ? { ...g, fuel: GENERATOR_MAX_FUEL } : g;
  }
  return out;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function step<TIn, TOut>(
  from: number,
  to: number,
  fn: (save: TIn) => TOut,
): MigrationStep {
  return {
    from,
    to,
    migrate: (save: unknown) => {
      if (!isPlainObject(save)) {
        throw new Error(
          `[save] Migration v${from}->v${to}: expected object, got ${typeof save}`,
        );
      }
      return fn(save as TIn);
    },
  };
}

export function selectMigratedStarter(save: {
  readonly drones?: Record<string, StarterDroneState>;
  readonly starterDrone?: StarterDroneState;
}): StarterDroneState | undefined {
  return save.drones?.[STARTER_DRONE_ID] ?? save.starterDrone;
}

export function requireMigratedStarter(save: {
  readonly drones?: Record<string, StarterDroneState>;
  readonly starterDrone?: StarterDroneState;
}): StarterDroneState {
  const starter = selectMigratedStarter(save);
  if (!starter) {
    throw new Error("[save] Migration expected a starter drone.");
  }
  return starter;
}

export function normalizeNonNegativeInteger(
  raw: unknown,
  fallback = 0,
): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(0, Math.floor(raw))
    : fallback;
}

export function normalizePositiveInteger(raw: unknown, fallback = 1): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(1, Math.floor(raw))
    : fallback;
}

export function normalizeTimestamp(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export function normalizePendingMultiplier(raw: unknown): 0 | 1 | 2 | 3 {
  return raw === 0 || raw === 1 || raw === 2 || raw === 3 ? raw : 1;
}

function isLegacyQuestShape(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.id === "string" &&
    typeof raw.type === "string" &&
    Array.isArray(raw.requiredItems)
  );
}

export function normalizeShipQuest(
  raw: unknown,
  fallbackPhase: number,
  field: "activeQuest" | "nextQuest",
): ShipQuest | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") {
    debugLog.general(
      `[save] Migration: ship.${field} is not an object; resetting to null.`,
    );
    return null;
  }

  const quest = raw as Record<string, unknown>;
  if (isLegacyQuestShape(quest)) {
    debugLog.general(
      `[save] Migration: ship.${field} uses legacy fields id/type/requiredItems; resetting to null.`,
    );
    return null;
  }

  const itemId = quest.itemId;
  const amount = quest.amount;
  const label = quest.label;
  const phase = normalizePositiveInteger(quest.phase, fallbackPhase);

  if (
    typeof itemId === "string" &&
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    typeof label === "string" &&
    label.length > 0
  ) {
    return {
      itemId: itemId as ShipQuest["itemId"],
      amount: Math.max(1, Math.floor(amount)),
      label,
      phase,
    };
  }

  debugLog.general(
    `[save] Migration: ship.${field} failed structure validation; resetting to null.`,
  );
  return null;
}

export function normalizeQuestHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const filtered = raw.filter((id): id is string => typeof id === "string");
  return filtered.slice(-SHIP_QUEST_HISTORY_SIZE);
}

export function normalizeShipState(raw: unknown): ShipState {
  const ship =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const departureAt = normalizeTimestamp(ship.departureAt ?? ship.departsAt);
  const questPhase = normalizePositiveInteger(ship.questPhase, 1);
  const activeQuest = normalizeShipQuest(
    ship.activeQuest,
    questPhase,
    "activeQuest",
  );
  const nextQuest = normalizeShipQuest(ship.nextQuest, questPhase, "nextQuest");
  const shipsSinceLastFragment = normalizeNonNegativeInteger(
    ship.shipsSinceLastFragment,
  );
  const pityCounter = normalizeNonNegativeInteger(
    ship.pityCounter,
    shipsSinceLastFragment,
  );
  const questHistory = normalizeQuestHistory(ship.questHistory);
  const status =
    ship.status === "docked" ||
    ship.status === "departing" ||
    ship.status === "sailing"
      ? ship.status
      : "sailing";

  return {
    status,
    activeQuest,
    nextQuest,
    questHistory,
    dockedAt: normalizeTimestamp(ship.dockedAt),
    departureAt,
    returnsAt:
      "returnsAt" in ship
        ? normalizeTimestamp(ship.returnsAt)
        : Date.now() + 30_000,
    rewardPending: ship.rewardPending === true,
    lastReward: (ship.lastReward as ShipState["lastReward"]) ?? null,
    questPhase,
    shipsSinceLastFragment,
    pityCounter,
    pendingMultiplier: normalizePendingMultiplier(ship.pendingMultiplier),
  };
}
