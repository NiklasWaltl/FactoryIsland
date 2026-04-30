import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { GameAction } from "../store/game-actions";
import {
  NATURAL_SPAWN_MS,
  SMITHY_TICK_MS,
  MANUAL_ASSEMBLER_TICK_MS,
  GENERATOR_TICK_MS,
  ENERGY_NET_TICK_MS,
  LOGISTICS_TICK_MS,
  CRAFTING_TICK_MS,
  DRONE_TICK_MS,
} from "../store/tick-constants";
import type { GameState } from "../store/types";

export function useGameTicks(
  state: GameState,
  dispatch: Dispatch<GameAction>,
): void {
  // Natural spawn timer
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "NATURAL_SPAWN" });
    }, NATURAL_SPAWN_MS);
    return () => clearInterval(id);
  }, []);

  // Sapling growth timer - uses ref to avoid stale closure + batch dispatch
  const saplingGrowAtRef = useRef(state.saplingGrowAt);
  saplingGrowAtRef.current = state.saplingGrowAt;

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const readyIds = Object.entries(saplingGrowAtRef.current)
        .filter(([, growAt]) => now >= growAt)
        .map(([assetId]) => assetId);
      if (readyIds.length > 0) {
        dispatch({ type: "GROW_SAPLINGS", assetIds: readyIds });
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Smithy processing tick
  useEffect(() => {
    if (!state.smithy.processing) return;
    const id = setInterval(() => {
      dispatch({ type: "SMITHY_TICK" });
    }, SMITHY_TICK_MS);
    return () => clearInterval(id);
  }, [state.smithy.processing]);

  // Manual assembler processing tick
  useEffect(() => {
    if (!state.manualAssembler.processing) return;
    const id = setInterval(() => {
      dispatch({ type: "MANUAL_ASSEMBLER_TICK" });
    }, MANUAL_ASSEMBLER_TICK_MS);
    return () => clearInterval(id);
  }, [state.manualAssembler.processing]);

  // Notification cleanup
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "EXPIRE_NOTIFICATIONS" });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Generator tick - fires when any generator is running
  const anyGeneratorRunning = Object.values(state.generators).some((g) => g.running);
  useEffect(() => {
    if (!anyGeneratorRunning) return;
    const id = setInterval(() => {
      dispatch({ type: "GENERATOR_TICK" });
    }, GENERATOR_TICK_MS);
    return () => clearInterval(id);
  }, [anyGeneratorRunning]);

  // Unified energy-network balance: production - consumption -> battery
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "ENERGY_NET_TICK" });
    }, ENERGY_NET_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Logistics tick: auto-miner production + conveyor movement
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "LOGISTICS_TICK" });
    }, LOGISTICS_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const hasPendingCraftingJobs = state.crafting.jobs.some(
    (job) => job.status !== "done" && job.status !== "cancelled",
  );

  const hasActiveKeepStockTargets = Object.values(state.keepStockByWorkbench ?? {}).some(
    (recipes) => Object.values(recipes).some((target) => !!target.enabled && target.amount > 0),
  );

  const shouldRunCraftingTick = hasPendingCraftingJobs || hasActiveKeepStockTargets;

  useEffect(() => {
    if (!shouldRunCraftingTick) return;
    const id = setInterval(() => {
      dispatch({ type: "JOB_TICK" });
    }, CRAFTING_TICK_MS);
    return () => clearInterval(id);
  }, [shouldRunCraftingTick]);

  // Drone tick: task selection, movement, pickup, deposit
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "DRONE_TICK" });
    }, DRONE_TICK_MS);
    return () => clearInterval(id);
  }, []);
}
