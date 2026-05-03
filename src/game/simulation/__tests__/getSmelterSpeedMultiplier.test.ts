import type { Module } from "../../modules/module.types";
import { getSmelterSpeedMultiplier } from "../smelting-utils";

function makeModule(module: Partial<Module> & Pick<Module, "type" | "tier">): Module {
  return {
    id: "module-1",
    equippedTo: null,
    ...module,
  };
}

describe("getSmelterSpeedMultiplier", () => {
  it("returns 1.0 when no module is equipped", () => {
    expect(getSmelterSpeedMultiplier(null)).toBe(1.0);
  });

  it("returns 1.0 for a non-smelter module", () => {
    expect(
      getSmelterSpeedMultiplier(makeModule({ type: "miner-boost", tier: 1 })),
    ).toBe(1.0);
  });

  it("returns the Tier 1 smelter boost multiplier", () => {
    expect(
      getSmelterSpeedMultiplier(makeModule({ type: "smelter-boost", tier: 1 })),
    ).toBe(1.1);
  });

  it("returns the Tier 2 smelter boost multiplier", () => {
    expect(
      getSmelterSpeedMultiplier(makeModule({ type: "smelter-boost", tier: 2 })),
    ).toBe(1.25);
  });

  it("returns the Tier 3 smelter boost multiplier", () => {
    expect(
      getSmelterSpeedMultiplier(makeModule({ type: "smelter-boost", tier: 3 })),
    ).toBe(1.5);
  });
});