import type { CraftingJob } from "../../../crafting/types";
import { createEmptyCraftingQueue } from "../../../crafting/types";
import type { GameAction } from "../../game-actions";
import type { CraftingContextState } from "../types";
import {
  CRAFTING_HANDLED_ACTION_TYPES,
  craftingContext,
} from "../crafting-context";

function createJob(overrides: Partial<CraftingJob> = {}): CraftingJob {
  return {
    id: "job-1",
    recipeId: "wood_pickaxe",
    workbenchId: "workbench-1",
    inventorySource: { kind: "global" },
    inputBuffer: [],
    status: "queued",
    priority: "normal",
    source: "player",
    enqueuedAt: 1,
    startedAt: null,
    finishesAt: null,
    progress: 0,
    ingredients: [{ itemId: "wood", count: 5 }],
    output: { itemId: "wood_pickaxe", count: 1 },
    processingTime: 3,
    reservationOwnerId: "job-1",
    ...overrides,
  } satisfies CraftingJob;
}

function createCraftingState(
  jobs: readonly CraftingJob[] = [],
): CraftingContextState {
  return {
    crafting: { ...createEmptyCraftingQueue(), jobs },
    keepStockByWorkbench: {},
    recipeAutomationPolicies: {},
  } satisfies CraftingContextState;
}

function expectHandled(
  result: CraftingContextState | null,
): CraftingContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected crafting action handled");
  return result;
}

describe("craftingContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createCraftingState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(craftingContext.reduce(state, action)).toBeNull();
    });

    it("CRAFT_REQUEST_WITH_PREREQUISITES keeps the slice unchanged during Phase 2", () => {
      const state = createCraftingState();
      const action = {
        type: "CRAFT_REQUEST_WITH_PREREQUISITES",
        recipeId: "wood_pickaxe",
        workbenchId: "workbench-1",
        source: "player",
      } satisfies GameAction;

      expect(craftingContext.reduce(state, action)).toBe(state);
    });

    it("JOB_ENQUEUE records the queue error when the workbench is outside the context slice", () => {
      const state = createCraftingState();
      const action = {
        type: "JOB_ENQUEUE",
        recipeId: "wood_pickaxe",
        workbenchId: "missing-workbench",
        source: "player",
      } satisfies GameAction;

      const result = expectHandled(craftingContext.reduce(state, action));

      expect(result.crafting.lastError?.kind).toBe("UNKNOWN_WORKBENCH");
    });

    it("JOB_CANCEL marks the job cancelled", () => {
      const state = createCraftingState([createJob()]);
      const action = {
        type: "JOB_CANCEL",
        jobId: "job-1",
      } satisfies GameAction;

      const result = expectHandled(craftingContext.reduce(state, action));

      expect(result.crafting.jobs[0].status).toBe("cancelled");
    });

    it("JOB_MOVE updates queue order metadata", () => {
      const state = createCraftingState([
        createJob({ id: "job-1", enqueuedAt: 1, priority: "normal" }),
        createJob({ id: "job-2", enqueuedAt: 2, priority: "normal" }),
      ]);
      const action = {
        type: "JOB_MOVE",
        jobId: "job-2",
        direction: "top",
      } satisfies GameAction;

      const result = expectHandled(craftingContext.reduce(state, action));

      expect(result.crafting.jobs[1].priority).toBe("high");
      expect(result.crafting.jobs[1].enqueuedAt).toBeLessThan(1);
    });

    it("JOB_SET_PRIORITY updates job priority", () => {
      const state = createCraftingState([createJob()]);
      const action = {
        type: "JOB_SET_PRIORITY",
        jobId: "job-1",
        priority: "low",
      } satisfies GameAction;

      const result = expectHandled(craftingContext.reduce(state, action));

      expect(result.crafting.jobs[0].priority).toBe("low");
    });

    it("JOB_TICK keeps the slice unchanged during Phase 2", () => {
      const state = createCraftingState([createJob()]);
      const action = { type: "JOB_TICK" } satisfies GameAction;

      expect(craftingContext.reduce(state, action)).toBe(state);
    });

    it("SET_KEEP_STOCK_TARGET stores the target by workbench and recipe", () => {
      const state = createCraftingState();
      const action = {
        type: "SET_KEEP_STOCK_TARGET",
        workbenchId: "workbench-1",
        recipeId: "wood_pickaxe",
        amount: 4,
        enabled: true,
      } satisfies GameAction;

      const result = expectHandled(craftingContext.reduce(state, action));

      expect(
        result.keepStockByWorkbench?.["workbench-1"]?.wood_pickaxe,
      ).toEqual({ enabled: true, amount: 4 });
    });

    it("SET_RECIPE_AUTOMATION_POLICY stores the recipe policy", () => {
      const state = createCraftingState();
      const action = {
        type: "SET_RECIPE_AUTOMATION_POLICY",
        recipeId: "wood_pickaxe",
        patch: { manualOnly: true },
      } satisfies GameAction;

      const result = expectHandled(craftingContext.reduce(state, action));

      expect(result.recipeAutomationPolicies?.wood_pickaxe).toEqual({
        manualOnly: true,
      });
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(craftingContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(craftingContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        CRAFTING_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(craftingContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
