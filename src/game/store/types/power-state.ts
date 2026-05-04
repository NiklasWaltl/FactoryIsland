// ---- Battery ----
export interface BatteryState {
  stored: number;
  capacity: number;
}

// ---- Generator ----
export interface GeneratorState {
  /** Wood currently in the fuel slot (local input buffer, capped at GENERATOR_MAX_FUEL) */
  fuel: number;
  /** Fractional charge progress within the current wood unit (0–1) */
  progress: number;
  /** Whether the generator is actively burning */
  running: boolean;
  /**
   * Wood the player has explicitly requested but that has not yet been delivered.
   * Drones only refill the generator while this counter is positive (no auto-refill).
   * Decremented as wood is deposited; reset implicitly when the generator is rebuilt.
   * Optional for save backward compatibility (treated as 0 when absent).
   */
  requestedRefill?: number;
}

export interface PowerState {
  cablesPlaced: number;
  powerPolesPlaced: number;
  generators: Record<string, GeneratorState>;
  battery: BatteryState;
  connectedAssetIds: string[];
  poweredMachineIds: string[];
  machinePowerRatio: Record<string, number>;
  energyDebugOverlay: boolean;
}
