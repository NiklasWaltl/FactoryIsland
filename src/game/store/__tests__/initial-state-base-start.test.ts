import { loadAndHydrate, serializeState } from "../../simulation/save";
import {
  BASE_START_IDS,
  hasRequiredBaseStartLayout,
} from "../../world/base-start-layout";
import { DOCK_WAREHOUSE_ID } from "../bootstrap/apply-dock-warehouse-layout";
import { getInitialCameraFocusTile } from "../../world/camera-focus";
import { isInsideStartArea } from "../../world/core-layout";
import { createInitialState } from "../initial-state";

describe("createInitialState base start layout", () => {
  it("materializes the central base start layout in the normal fresh state", () => {
    const state = createInitialState("release");

    expect(hasRequiredBaseStartLayout(state)).toBe(true);
    expect(state.assets[BASE_START_IDS.mapShop]).toMatchObject({
      type: "map_shop",
      fixed: true,
    });
    expect(state.assets[BASE_START_IDS.serviceHub]).toMatchObject({
      type: "service_hub",
      fixed: true,
    });
    expect(state.assets[BASE_START_IDS.warehouse]).toMatchObject({
      type: "warehouse",
    });
    expect(state.serviceHubs[BASE_START_IDS.serviceHub].droneIds).toEqual([
      "starter",
    ]);
    expect(state.drones.starter.hubId).toBe(BASE_START_IDS.serviceHub);
    expect(state.drones.starter.hubId).toBe(BASE_START_IDS.serviceHub);
    expect(state.warehousesPlaced).toBe(2);
    expect(state.warehousesPurchased).toBe(2);
  });

  it("hydrates a saved fresh state without duplicating base starter objects", () => {
    const original = createInitialState("release");
    const hydrated = loadAndHydrate(serializeState(original), "release");

    expect(hasRequiredBaseStartLayout(hydrated)).toBe(true);
    for (const id of Object.values(BASE_START_IDS)) {
      expect(
        Object.values(hydrated.assets).filter((asset) => asset.id === id),
      ).toHaveLength(1);
    }
    expect(Object.keys(hydrated.serviceHubs)).toEqual([
      BASE_START_IDS.serviceHub,
    ]);
    expect(Object.keys(hydrated.warehouseInventories)).toEqual(
      expect.arrayContaining([BASE_START_IDS.warehouse, DOCK_WAREHOUSE_ID]),
    );
    expect(Object.keys(hydrated.warehouseInventories)).toHaveLength(2);
  });

  it("keeps the camera focus anchor valid for the materialized start area", () => {
    const state = createInitialState("release");
    const focus = getInitialCameraFocusTile(state.tileMap);

    expect(isInsideStartArea(focus.row, focus.col, state.tileMap)).toBe(true);
  });
});
