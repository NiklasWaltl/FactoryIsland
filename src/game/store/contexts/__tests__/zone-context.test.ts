import type { GameAction } from "../../game-actions";
import type { ZoneContextState } from "../types";
import { ZONE_HANDLED_ACTION_TYPES, zoneContext } from "../zone-context";

function createZoneState(
  overrides: Partial<ZoneContextState> = {},
): ZoneContextState {
  return {
    productionZones: {},
    buildingZoneIds: {},
    buildingSourceWarehouseIds: {},
    ...overrides,
  } satisfies ZoneContextState;
}

function expectHandled(result: ZoneContextState | null): ZoneContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected zone action handled");
  return result;
}

describe("zoneContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createZoneState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(zoneContext.reduce(state, action)).toBeNull();
    });

    it("CREATE_ZONE inserts a new production zone with a generated name", () => {
      const state = createZoneState();
      const action = { type: "CREATE_ZONE" } satisfies GameAction;

      const result = expectHandled(zoneContext.reduce(state, action));

      const entries = Object.values(result.productionZones);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe("Zone 1");
    });

    it("CREATE_ZONE accepts a custom name", () => {
      const state = createZoneState();
      const action = {
        type: "CREATE_ZONE",
        name: "Smelting Yard",
      } satisfies GameAction;

      const result = expectHandled(zoneContext.reduce(state, action));

      const entries = Object.values(result.productionZones);
      expect(entries[0]?.name).toBe("Smelting Yard");
    });

    it("DELETE_ZONE removes the zone and clears its building assignments", () => {
      const state = createZoneState({
        productionZones: {
          "zone-1": { id: "zone-1", name: "Zone 1" },
          "zone-2": { id: "zone-2", name: "Zone 2" },
        },
        buildingZoneIds: {
          "building-a": "zone-1",
          "building-b": "zone-2",
        },
      });
      const action = {
        type: "DELETE_ZONE",
        zoneId: "zone-1",
      } satisfies GameAction;

      const result = expectHandled(zoneContext.reduce(state, action));

      expect(result.productionZones).toEqual({
        "zone-2": { id: "zone-2", name: "Zone 2" },
      });
      expect(result.buildingZoneIds).toEqual({ "building-b": "zone-2" });
    });

    it("DELETE_ZONE is a no-op when the zone does not exist", () => {
      const state = createZoneState();
      const action = {
        type: "DELETE_ZONE",
        zoneId: "missing",
      } satisfies GameAction;

      expect(zoneContext.reduce(state, action)).toBe(state);
    });

    it("SET_BUILDING_ZONE assigns a building to an existing zone", () => {
      const state = createZoneState({
        productionZones: { "zone-1": { id: "zone-1", name: "Zone 1" } },
      });
      const action = {
        type: "SET_BUILDING_ZONE",
        buildingId: "building-a",
        zoneId: "zone-1",
      } satisfies GameAction;

      const result = expectHandled(zoneContext.reduce(state, action));

      expect(result.buildingZoneIds).toEqual({ "building-a": "zone-1" });
    });

    it("SET_BUILDING_ZONE clears an existing assignment when zoneId is null", () => {
      const state = createZoneState({
        buildingZoneIds: { "building-a": "zone-1" },
      });
      const action = {
        type: "SET_BUILDING_ZONE",
        buildingId: "building-a",
        zoneId: null,
      } satisfies GameAction;

      const result = expectHandled(zoneContext.reduce(state, action));

      expect(result.buildingZoneIds).toEqual({});
    });

    it("SET_BUILDING_ZONE is a no-op when the target zone does not exist", () => {
      const state = createZoneState();
      const action = {
        type: "SET_BUILDING_ZONE",
        buildingId: "building-a",
        zoneId: "missing",
      } satisfies GameAction;

      expect(zoneContext.reduce(state, action)).toBe(state);
    });

    it("SET_BUILDING_SOURCE assigns a warehouse to a building", () => {
      const state = createZoneState();
      const action = {
        type: "SET_BUILDING_SOURCE",
        buildingId: "building-a",
        warehouseId: "warehouse-1",
      } satisfies GameAction;

      const result = expectHandled(zoneContext.reduce(state, action));

      expect(result.buildingSourceWarehouseIds).toEqual({
        "building-a": "warehouse-1",
      });
    });

    it("SET_BUILDING_SOURCE clears an existing mapping when warehouseId is null", () => {
      const state = createZoneState({
        buildingSourceWarehouseIds: { "building-a": "warehouse-1" },
      });
      const action = {
        type: "SET_BUILDING_SOURCE",
        buildingId: "building-a",
        warehouseId: null,
      } satisfies GameAction;

      const result = expectHandled(zoneContext.reduce(state, action));

      expect(result.buildingSourceWarehouseIds).toEqual({});
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(zoneContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(zoneContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        ZONE_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(zoneContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
