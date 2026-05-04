import { GENERATOR_MAX_FUEL } from "../../../../../store/constants/buildings/index";
import type { GameState, PlacedAsset } from "../../../../../store/types";
import { handleDepositingStatus } from "../index";
import { depositGenerator } from "../deposit-generator";
import {
  createIdleDrone,
  createMinimalState,
  createMockDeps,
  emptyHubInventory,
  withDrone,
} from "./test-helpers";

function createGeneratorAsset(id: string): PlacedAsset {
  return {
    id,
    type: "generator",
    x: 5,
    y: 5,
    size: 2,
    width: 2,
    height: 2,
  };
}

function withGenerator(
  state: GameState,
  generatorId: string,
  fuel: number,
): GameState {
  return {
    ...state,
    assets: {
      ...state.assets,
      [generatorId]: createGeneratorAsset(generatorId),
    },
    generators: {
      ...state.generators,
      [generatorId]: {
        fuel,
        progress: 0,
        running: false,
        requestedRefill: 8,
      },
    },
  };
}

function withFallbackHub(state: GameState, hubId: string): GameState {
  return {
    ...state,
    assets: {
      ...state.assets,
      [hubId]: {
        id: hubId,
        type: "service_hub",
        x: 8,
        y: 8,
        size: 2,
        width: 2,
        height: 2,
      },
    },
    serviceHubs: {
      [hubId]: {
        inventory: { ...emptyHubInventory },
        targetStock: { ...emptyHubInventory },
        tier: 1,
        droneIds: [state.starterDrone.droneId],
      },
    },
  };
}

describe("depositGenerator", () => {
  it("stores cargo in a generator under capacity and reports deposited", () => {
    const deps = createMockDeps();
    const generatorId = "generator-test";
    const state = withGenerator(
      {
        ...createMinimalState(),
        inventory: { ...createMinimalState().inventory, wood: 0 },
      },
      generatorId,
      3,
    );
    const drone = state.starterDrone;

    const outcome = depositGenerator(state, drone.droneId, {
      deliveryId: generatorId,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "wood", amount: 5 },
      deps,
    });

    expect(outcome.outcome).toBe("deposited");
    if (!outcome.handled) throw new Error("expected generator deposit");
    expect(outcome.nextState.generators[generatorId]).toMatchObject({
      fuel: 8,
      requestedRefill: 3,
    });
    expect(outcome.nextState.inventory.wood).toBe(0);
    expect(outcome.nextState.starterDrone.cargo).toBeNull();
  });

  it("reports not_deposited when full and delegates to fallback", () => {
    const deps = createMockDeps();
    const generatorId = "generator-test";
    const hubId = "hub-test";
    const fullGeneratorState = withFallbackHub(
      withGenerator(
        {
          ...createMinimalState(),
          inventory: { ...createMinimalState().inventory, wood: 0 },
        },
        generatorId,
        GENERATOR_MAX_FUEL,
      ),
      hubId,
    );
    const directOutcome = depositGenerator(
      fullGeneratorState,
      fullGeneratorState.starterDrone.droneId,
      {
        deliveryId: generatorId,
        idleDrone: createIdleDrone(fullGeneratorState.starterDrone),
        cargo: { itemType: "wood", amount: 4 },
        deps,
      },
    );
    expect(directOutcome.outcome).toBe("not_deposited");
    expect(directOutcome.handled).toBe(false);

    const { state, drone } = withDrone(fullGeneratorState, {
      status: "depositing",
      ticksRemaining: 1,
      hubId,
      currentTaskType: "building_supply",
      deliveryTargetId: generatorId,
      cargo: { itemType: "wood", amount: 4 },
    });

    const next = handleDepositingStatus(state, drone.droneId, drone, deps);

    expect(next.generators[generatorId].fuel).toBe(GENERATOR_MAX_FUEL);
    expect(next.serviceHubs[hubId].inventory.wood).toBe(4);
    expect(next.inventory.wood).toBe(0);
  });
});
