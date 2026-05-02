export type ModuleType = "miner-boost" | "smelter-boost";

export interface Module {
  id: string;
  type: ModuleType;
  tier: 1 | 2 | 3;
  equippedTo: string | null;
}
