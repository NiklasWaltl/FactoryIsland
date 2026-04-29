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