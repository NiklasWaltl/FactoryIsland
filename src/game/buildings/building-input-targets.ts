import { getBuildingInputConfig } from "../store/constants/buildings/index";
import { COLLECTABLE_KEYS } from "../store/constants/resources";
import { DOCK_WAREHOUSE_ID } from "../store/bootstrap/apply-dock-warehouse-layout";
import type { CollectableItemType, GameState } from "../store/types";

type BuildingInputTargetState = Pick<GameState, "assets"> &
  Partial<Pick<GameState, "ship">>;

/** Reads the current amount in a building's input buffer. */
export function getBuildingInputCurrent(
  state: Pick<GameState, "assets" | "generators">,
  assetId: string,
): number {
  const asset = state.assets[assetId];
  if (!asset) return 0;
  if (asset.type === "generator") return state.generators[assetId]?.fuel ?? 0;
  return 0;
}

/** Lists every placed asset that owns an input buffer, paired with its accepted resource. */
export function getBuildingInputTargets(
  state: BuildingInputTargetState,
): { assetId: string; resource: CollectableItemType; capacity: number }[] {
  const out: {
    assetId: string;
    resource: CollectableItemType;
    capacity: number;
  }[] = [];
  for (const asset of Object.values(state.assets)) {
    const cfg = getBuildingInputConfig(asset.type);
    if (!cfg) continue;
    out.push({
      assetId: asset.id,
      resource: cfg.resource,
      capacity: cfg.capacity,
    });
  }

  const quest = state.ship?.status === "docked" ? state.ship.activeQuest : null;
  const dockWarehouse = state.assets[DOCK_WAREHOUSE_ID];
  if (
    quest &&
    dockWarehouse?.isDockWarehouse === true &&
    COLLECTABLE_KEYS.has(quest.itemId)
  ) {
    out.push({
      assetId: dockWarehouse.id,
      resource: quest.itemId as CollectableItemType,
      capacity: quest.amount,
    });
  }

  return out;
}
