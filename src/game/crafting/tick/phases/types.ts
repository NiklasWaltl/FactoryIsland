import type { Inventory, ServiceHubEntry } from "../../../store/types";
import type { WarehouseId } from "../../../items/types";
import type { NetworkSlice } from "../../../inventory/reservationTypes";
import type { CraftingJob } from "../../types";

export interface CraftingTickState {
  warehouseInventories: Readonly<Record<WarehouseId, Inventory>>;
  globalInventory: Inventory;
  serviceHubs: Readonly<Record<string, ServiceHubEntry>>;
  network: NetworkSlice;
  jobs: readonly CraftingJob[];
  changed: boolean;
}
