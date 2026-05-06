import type { Module } from "../../modules/module.types";
import { getAutoSmelterTickInterval } from "../smelting-utils";

function makeSmelterModule(tier: Module["tier"]): Module {
  return {
    id: `smelter-module-${tier}`,
    type: "smelter-boost",
    tier,
    equippedTo: null,
  };
}

describe("getAutoSmelterTickInterval", () => {
  it("keeps the base interval when no module is equipped", () => {
    expect(getAutoSmelterTickInterval(10, null)).toBe(10);
  });

  it("applies the Tier 1 interval", () => {
    expect(getAutoSmelterTickInterval(10, makeSmelterModule(1))).toBe(9);
  });

  it("applies the Tier 2 interval", () => {
    expect(getAutoSmelterTickInterval(10, makeSmelterModule(2))).toBe(8);
  });

  it("applies the Tier 3 interval", () => {
    expect(getAutoSmelterTickInterval(10, makeSmelterModule(3))).toBe(6);
  });

  it("never returns a zero-tick interval", () => {
    expect(getAutoSmelterTickInterval(1, makeSmelterModule(3))).toBe(1);
  });
});
