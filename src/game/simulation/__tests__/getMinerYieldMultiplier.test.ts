import type { Module } from "../../modules/module.types";
import { getMinerYieldMultiplier } from "../mining-utils";

function makeModule(
  module: Partial<Module> & Pick<Module, "type" | "tier">,
): Module {
  return {
    id: "module-1",
    equippedTo: null,
    ...module,
  };
}

describe("getMinerYieldMultiplier", () => {
  it("returns 1.0 when no module is equipped", () => {
    expect(getMinerYieldMultiplier(null)).toBe(1.0);
  });

  it("returns 1.0 for a non-miner module", () => {
    expect(
      getMinerYieldMultiplier(makeModule({ type: "smelter-boost", tier: 1 })),
    ).toBe(1.0);
  });

  it("returns the Tier 1 miner boost multiplier", () => {
    expect(
      getMinerYieldMultiplier(makeModule({ type: "miner-boost", tier: 1 })),
    ).toBe(1.1);
  });

  it("returns the Tier 2 miner boost multiplier", () => {
    expect(
      getMinerYieldMultiplier(makeModule({ type: "miner-boost", tier: 2 })),
    ).toBe(1.25);
  });

  it("returns the Tier 3 miner boost multiplier", () => {
    expect(
      getMinerYieldMultiplier(makeModule({ type: "miner-boost", tier: 3 })),
    ).toBe(1.5);
  });
});
