import type { CraftingJob } from "../../crafting/types";

export type ConveyorItem =
  | "stone"
  | "iron"
  | "copper"
  | "ironIngot"
  | "copperIngot"
  | "metalPlate"
  | "gear";

export interface ConveyorState {
  queue: ConveyorItem[];
}

export type ConveyorTargetType =
  | "warehouse_input_tile"
  | "next_conveyor"
  | "adjacent_warehouse"
  | "workbench"
  | "smithy";

export type ConveyorTargetBlockReason =
  | "warehouse_input_tile_zone_incompatible"
  | "warehouse_input_tile_missing_inventory"
  | "warehouse_input_tile_full"
  | "next_conveyor_already_moved"
  | "next_conveyor_zone_incompatible"
  | "next_conveyor_full"
  | "adjacent_warehouse_zone_incompatible"
  | "adjacent_warehouse_missing_inventory"
  | "adjacent_warehouse_full"
  | "workbench_no_active_job"
  | "workbench_zone_incompatible"
  | "workbench_source_full"
  | "smithy_zone_incompatible"
  | "smithy_item_not_supported"
  | "smithy_full";

export type ConveyorNoTargetReason =
  | "next_tile_out_of_bounds"
  | "next_conveyor_direction_mismatch"
  | "adjacent_warehouse_input_mismatch"
  | "no_supported_target";

export type ConveyorTargetDecision =
  | {
      kind: "target";
      targetType: "next_conveyor";
      targetId: string;
      nextAssetId: string;
    }
  | {
      kind: "target";
      targetType: "workbench";
      targetId: string;
      workbenchJob: Pick<CraftingJob, "id" | "status">;
    }
  | {
      kind: "target";
      targetType: Exclude<
        ConveyorTargetType,
        "smithy" | "next_conveyor" | "workbench"
      >;
      targetId: string;
    }
  | {
      kind: "target";
      targetType: "smithy";
      targetId: string;
      smithyOreKey: "iron" | "copper";
    }
  | {
      kind: "blocked";
      targetType: "next_conveyor";
      targetId: string;
      nextAssetId: string;
      blockReason: ConveyorTargetBlockReason;
    }
  | {
      kind: "blocked";
      targetType: Exclude<ConveyorTargetType, "next_conveyor">;
      targetId: string;
      blockReason: ConveyorTargetBlockReason;
    }
  | { kind: "no_target"; blockReason: ConveyorNoTargetReason };

export type ConveyorTargetEligibility =
  | { eligible: true }
  | { eligible: false; blockReason: ConveyorTargetBlockReason };

export interface ConveyorTargetEligibilityCheck {
  condition: boolean;
  blockReason: ConveyorTargetBlockReason;
}

export type AutoSmelterStatus =
  | "IDLE"
  | "PROCESSING"
  | "OUTPUT_BLOCKED"
  | "NO_POWER"
  | "MISCONFIGURED";

export interface AutoSmelterProcessing {
  inputItem: ConveyorItem;
  outputItem: ConveyorItem;
  progressMs: number;
  durationMs: number;
}

export interface AutoSmelterEntry {
  inputBuffer: ConveyorItem[];
  processing: AutoSmelterProcessing | null;
  pendingOutput: ConveyorItem[];
  status: AutoSmelterStatus;
  lastRecipeInput: string | null;
  lastRecipeOutput: string | null;
  throughputEvents: number[];
  selectedRecipe: "iron" | "copper";
}

/** Two fixed V1 recipes for the auto-assembler (not a generic recipe id). */
export type AutoAssemblerRecipeId = "metal_plate" | "gear";

export type AutoAssemblerStatus =
  | "IDLE"
  | "PROCESSING"
  | "OUTPUT_BLOCKED"
  | "NO_POWER"
  | "MISCONFIGURED";

/** Belt-fed assembler V1: iron ingots in, metal plate or gear out (no warehouse output fallback). */
export interface AutoAssemblerEntry {
  /** Count of iron ingots held for processing (same logical buffer for both recipes). */
  ironIngotBuffer: number;
  processing: {
    outputItem: Extract<ConveyorItem, "metalPlate" | "gear">;
    progressMs: number;
    durationMs: number;
  } | null;
  /** At most one finished item waiting for the output belt. */
  pendingOutput: ConveyorItem[];
  status: AutoAssemblerStatus;
  selectedRecipe: AutoAssemblerRecipeId;
}
