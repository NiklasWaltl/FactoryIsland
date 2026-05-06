// ============================================================
// Tests — RESEARCH_BUILDING action (Research Lab unlock pipeline)
// ============================================================
//
// Covers the dedicated action surface introduced together with
// the Research Lab building:
//   1. Successful research: items consumed, building unlocked,
//      success notification surfaced.
//   2. Re-research is idempotent: no item drain, error surface.
//   3. Insufficient items: no item drain, no unlock, error surface.

import { gameReducer, createInitialState } from "../reducer";
import type { GameState } from "../types";
import { RESEARCH_RECIPES } from "../../simulation/recipes/research-recipes";

function richState(): GameState {
  const base = createInitialState("release");
  return {
    ...base,
    inventory: {
      ...base.inventory,
      ironIngot: 999,
      metalPlate: 999,
      gear: 999,
    },
  };
}

describe("RESEARCH_BUILDING", () => {
  const smithyRecipe = RESEARCH_RECIPES.find(
    (r) => r.buildingType === "smithy",
  );

  it("research recipes table covers every gated building", () => {
    expect(smithyRecipe).toBeDefined();
    // 16 recipes cover all buildings beyond the tier-0 starter set.
    expect(RESEARCH_RECIPES).toHaveLength(16);
  });

  it("unlocks the building, consumes items, and surfaces a success notification", () => {
    const before = richState();
    const ironBefore = before.inventory.ironIngot;
    expect(before.unlockedBuildings).not.toContain("smithy");

    const after = gameReducer(before, {
      type: "RESEARCH_BUILDING",
      recipeId: smithyRecipe!.id,
    });

    expect(after.unlockedBuildings).toContain("smithy");
    expect(after.inventory.ironIngot).toBeLessThan(ironBefore);
    expect(
      after.notifications.some(
        (n) => n.kind === "success" && /freigeschaltet/.test(n.displayName),
      ),
    ).toBe(true);
  });

  it("is idempotent: re-research drains nothing and surfaces an error", () => {
    const start = richState();
    const first = gameReducer(start, {
      type: "RESEARCH_BUILDING",
      recipeId: smithyRecipe!.id,
    });
    const ironAfterFirst = first.inventory.ironIngot;
    const occurrencesAfterFirst = first.unlockedBuildings.filter(
      (b) => b === "smithy",
    ).length;

    const second = gameReducer(first, {
      type: "RESEARCH_BUILDING",
      recipeId: smithyRecipe!.id,
    });

    expect(second.inventory.ironIngot).toBe(ironAfterFirst);
    expect(second.unlockedBuildings.filter((b) => b === "smithy").length).toBe(
      occurrencesAfterFirst,
    );
    expect(second.notifications.some((n) => n.kind === "error")).toBe(true);
  });

  it("rejects research when items are insufficient", () => {
    const base = createInitialState("release");
    const start: GameState = {
      ...base,
      inventory: { ...base.inventory, ironIngot: 1 },
    };

    const after = gameReducer(start, {
      type: "RESEARCH_BUILDING",
      recipeId: smithyRecipe!.id,
    });

    expect(after.unlockedBuildings).not.toContain("smithy");
    expect(after.inventory.ironIngot).toBe(1);
    expect(after.notifications.some((n) => n.kind === "error")).toBe(true);
  });

  it("returns an error for an unknown recipe id", () => {
    const start = richState();
    const after = gameReducer(start, {
      type: "RESEARCH_BUILDING",
      recipeId: "research_does_not_exist",
    });

    expect(after.unlockedBuildings).toEqual(start.unlockedBuildings);
    expect(after.inventory).toEqual(start.inventory);
    expect(after.notifications.some((n) => n.kind === "error")).toBe(true);
  });
});
