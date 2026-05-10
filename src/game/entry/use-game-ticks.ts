import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { GameAction } from "../store/game-actions";
import {
  NATURAL_SPAWN_MS,
  LOGISTICS_TICK_MS,
  CRAFTING_TICK_MS,
  DRONE_TICK_MS,
  SHIP_TICK_MS,
} from "../store/constants/timing/timing";
import {
  SMITHY_TICK_MS,
  MANUAL_ASSEMBLER_TICK_MS,
} from "../store/constants/timing/workbench-timing";
import { MODULE_LAB_TICK_MS } from "../constants/moduleLabConstants";
import { GENERATOR_TICK_MS } from "../store/constants/energy/generator";
import { ENERGY_NET_TICK_MS } from "../store/constants/energy/energy-smelter";
import type { GameState } from "../store/types";

// Base cadence of the central tick orchestrator. All non-spawn tick frequencies
// (100/200/500/1000/2000 ms) are integer multiples of this value, so each
// configured action fires at its original rate while sharing one timer.
const BASE_TICK_MS = 100;

export function useGameTicks(
  state: GameState,
  dispatch: Dispatch<GameAction>,
): void {
  // Stable wrapper that turns a thrown handler error into a visible
  // ADD_ERROR_NOTIFICATION dispatch. Shared across every tick interval in this
  // hook so any tick-handler crash surfaces the same way.
  const dispatchRef = useRef(dispatch);
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);
  const safeDispatchRef = useRef((action: GameAction, tick = 0): void => {
    try {
      dispatchRef.current(action);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error(`[tick] ${action.type} failed:`, err);
      }
      try {
        dispatchRef.current({
          type: "ADD_ERROR_NOTIFICATION",
          message: `${action.type}: ${message}`,
          sourceAction: action.type,
          tick,
        });
      } catch {
        // Notification dispatch itself failed — nothing further we can do.
      }
    }
  });

  // Natural spawn timer — long-period, no interaction with the orchestrator.
  useEffect(() => {
    const id = setInterval(() => {
      safeDispatchRef.current({ type: "NATURAL_SPAWN" });
    }, NATURAL_SPAWN_MS);
    return () => clearInterval(id);
  }, []);

  // Sapling growth timer - uses ref to avoid stale closure + batch dispatch.
  const saplingGrowAtRef = useRef(state.saplingGrowAt);
  useEffect(() => {
    saplingGrowAtRef.current = state.saplingGrowAt;
  }, [state.saplingGrowAt]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const readyIds = Object.entries(saplingGrowAtRef.current)
        .filter(([, growAt]) => now >= growAt)
        .map(([assetId]) => assetId);
      if (readyIds.length > 0) {
        safeDispatchRef.current({ type: "GROW_SAPLINGS", assetIds: readyIds });
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ----------------------------------------------------------------
  // Conditional flags — refs keep the orchestrator effect dependency-free,
  // so its setInterval is created exactly once per mount.
  // ----------------------------------------------------------------
  const smithyProcessingRef = useRef(state.smithy.processing);
  useEffect(() => {
    smithyProcessingRef.current = state.smithy.processing;
  }, [state.smithy.processing]);

  const manualAssemblerProcessingRef = useRef(state.manualAssembler.processing);
  useEffect(() => {
    manualAssemblerProcessingRef.current = state.manualAssembler.processing;
  }, [state.manualAssembler.processing]);

  const moduleLabJobActiveRef = useRef(state.moduleLabJob !== null);
  useEffect(() => {
    moduleLabJobActiveRef.current = state.moduleLabJob !== null;
  }, [state.moduleLabJob]);

  const anyGeneratorRunningRef = useRef(false);
  const anyGeneratorRunning = Object.values(state.generators).some(
    (g) => g.running,
  );
  useEffect(() => {
    anyGeneratorRunningRef.current = anyGeneratorRunning;
  }, [anyGeneratorRunning]);

  const hasPendingCraftingJobs = state.crafting.jobs.some(
    (job) => job.status !== "done" && job.status !== "cancelled",
  );
  const hasActiveKeepStockTargets = Object.values(
    state.keepStockByWorkbench ?? {},
  ).some((recipes) =>
    Object.values(recipes).some(
      (target) => !!target.enabled && target.amount > 0,
    ),
  );
  const shouldRunCraftingTickRef = useRef(false);
  useEffect(() => {
    shouldRunCraftingTickRef.current =
      hasPendingCraftingJobs || hasActiveKeepStockTargets;
  }, [hasPendingCraftingJobs, hasActiveKeepStockTargets]);

  // ----------------------------------------------------------------
  // Central orchestrator: one setInterval, deterministic in-tick order.
  // Order within a single firing:
  //   1. GENERATOR_TICK     — updates fuel/production state
  //   2. ENERGY_NET_TICK    — reads fresh generator state, allocates power
  //   3. LOGISTICS_TICK     — reads fresh poweredMachineIds / powerRatio
  //   4. DRONE_TICK         — operates on logistics-updated inventories
  //   5. JOB_TICK           — consumes inputs after logistics + drone moves
  // Workbench/lab/notification ticks are independent of the chain and
  // dispatched after the chain in stable order.
  // ----------------------------------------------------------------
  useEffect(() => {
    const generatorEvery = Math.max(
      1,
      Math.round(GENERATOR_TICK_MS / BASE_TICK_MS),
    );
    const energyNetEvery = Math.max(
      1,
      Math.round(ENERGY_NET_TICK_MS / BASE_TICK_MS),
    );
    const logisticsEvery = Math.max(
      1,
      Math.round(LOGISTICS_TICK_MS / BASE_TICK_MS),
    );
    const droneEvery = Math.max(1, Math.round(DRONE_TICK_MS / BASE_TICK_MS));
    const craftingEvery = Math.max(
      1,
      Math.round(CRAFTING_TICK_MS / BASE_TICK_MS),
    );
    const shipEvery = Math.max(1, Math.round(SHIP_TICK_MS / BASE_TICK_MS));
    const smithyEvery = Math.max(1, Math.round(SMITHY_TICK_MS / BASE_TICK_MS));
    const manualAssemblerEvery = Math.max(
      1,
      Math.round(MANUAL_ASSEMBLER_TICK_MS / BASE_TICK_MS),
    );
    const moduleLabEvery = Math.max(
      1,
      Math.round(MODULE_LAB_TICK_MS / BASE_TICK_MS),
    );
    const notificationsEvery = Math.max(1, Math.round(500 / BASE_TICK_MS));

    let tick = 0;
    const dispatchSafely = (action: GameAction): void =>
      safeDispatchRef.current(action, tick);

    const id = setInterval(() => {
      tick++;

      // 1. GENERATOR_TICK — must precede ENERGY_NET_TICK so power allocation
      //    sees up-to-date fuel state.
      if (tick % generatorEvery === 0 && anyGeneratorRunningRef.current) {
        dispatchSafely({ type: "GENERATOR_TICK" });
      }

      // 2. ENERGY_NET_TICK — allocates power, writes poweredMachineIds.
      if (tick % energyNetEvery === 0) {
        dispatchSafely({ type: "ENERGY_NET_TICK" });
      }

      // 3. LOGISTICS_TICK — reads freshly written poweredMachineIds.
      if (tick % logisticsEvery === 0) {
        dispatchSafely({ type: "LOGISTICS_TICK" });
      }

      // 4. DRONE_TICK — operates after logistics has resolved conveyor moves.
      if (tick % droneEvery === 0) {
        dispatchSafely({ type: "DRONE_TICK" });
      }

      // 5. JOB_TICK — consumes inputs after logistics and drone deposits.
      if (tick % craftingEvery === 0 && shouldRunCraftingTickRef.current) {
        dispatchSafely({ type: "JOB_TICK" });
      }

      // Independent ticks (no ordering interaction with the chain above).
      if (tick % smithyEvery === 0 && smithyProcessingRef.current) {
        dispatchSafely({ type: "SMITHY_TICK" });
      }
      if (
        tick % manualAssemblerEvery === 0 &&
        manualAssemblerProcessingRef.current
      ) {
        dispatchSafely({ type: "MANUAL_ASSEMBLER_TICK" });
      }
      if (tick % moduleLabEvery === 0 && moduleLabJobActiveRef.current) {
        dispatchSafely({ type: "MODULE_LAB_TICK" });
      }
      if (tick % shipEvery === 0) {
        dispatchSafely({ type: "SHIP_TICK" });
      }
      if (tick % notificationsEvery === 0) {
        dispatchSafely({ type: "EXPIRE_NOTIFICATIONS" });
      }
    }, BASE_TICK_MS);

    return () => clearInterval(id);
  }, []);
}
