import type { CraftingInventorySource } from "../../crafting/types";
import { getZoneWarehouseIds } from "../../zones/production-zone-aggregation";
import type { CraftingSource, GameState } from "../types";

export function toCraftingJobInventorySource(
  state: GameState,
  source: CraftingSource,
): CraftingInventorySource {
  if (source.kind === "global") {
    return { kind: "global" };
  }
  if (source.kind === "zone") {
    return {
      kind: "zone",
      zoneId: source.zoneId,
      warehouseIds: getZoneWarehouseIds(state, source.zoneId),
    };
  }
  return { kind: "warehouse", warehouseId: source.warehouseId };
}
