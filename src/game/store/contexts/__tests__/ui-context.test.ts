import type { GameAction } from "../../game-actions";
import { EMPTY_HOTBAR_SLOT } from "../../constants/ui/hotbar";
import type { UiContextState } from "../types";
import { UI_HANDLED_ACTION_TYPES, uiContext } from "../ui-context";

function createUiState(
  overrides: Partial<UiContextState> = {},
): UiContextState {
  return {
    selectedWarehouseId: null,
    selectedPowerPoleId: null,
    selectedAutoMinerId: null,
    selectedAutoSmelterId: null,
    selectedAutoAssemblerId: null,
    selectedGeneratorId: null,
    selectedServiceHubId: null,
    selectedCraftingBuildingId: null,
    selectedSplitterId: null,
    openPanel: null,
    notifications: [],
    buildMode: false,
    selectedBuildingType: null,
    selectedFloorTile: null,
    hotbarSlots: Array.from({ length: 3 }, () => ({ ...EMPTY_HOTBAR_SLOT })),
    activeSlot: 0,
    energyDebugOverlay: false,
    ...overrides,
  } satisfies UiContextState;
}

function expectHandled(result: UiContextState | null): UiContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected UI action handled");
  return result;
}

describe("uiContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createUiState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(uiContext.reduce(state, action)).toBeNull();
    });

    it("SET_ACTIVE_SLOT updates activeSlot and clamps to the hotbar length", () => {
      const state = createUiState();
      const action = { type: "SET_ACTIVE_SLOT", slot: 99 } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.activeSlot).toBe(2);
    });

    it("TOGGLE_PANEL opens the requested panel when none is open", () => {
      const state = createUiState();
      const action = {
        type: "TOGGLE_PANEL",
        panel: "warehouse",
      } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.openPanel).toBe("warehouse");
    });

    it("TOGGLE_PANEL closes the panel when the same panel is re-toggled", () => {
      const state = createUiState({ openPanel: "warehouse" });
      const action = {
        type: "TOGGLE_PANEL",
        panel: "warehouse",
      } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.openPanel).toBeNull();
    });

    it("CLOSE_PANEL clears openPanel and all selected building ids", () => {
      const state = createUiState({
        openPanel: "warehouse",
        selectedAutoMinerId: "miner-1",
        selectedWarehouseId: "warehouse-1",
        selectedSplitterId: "splitter-1",
      });
      const action = { type: "CLOSE_PANEL" } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.openPanel).toBeNull();
      expect(result.selectedAutoMinerId).toBeNull();
      expect(result.selectedWarehouseId).toBeNull();
      expect(result.selectedSplitterId).toBeNull();
    });

    it("TOGGLE_ENERGY_DEBUG flips the overlay flag", () => {
      const state = createUiState();
      const action = { type: "TOGGLE_ENERGY_DEBUG" } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.energyDebugOverlay).toBe(true);
    });

    it("TOGGLE_BUILD_MODE entering build mode clears panel & warehouse id", () => {
      const state = createUiState({
        openPanel: "warehouse",
        selectedWarehouseId: "warehouse-1",
      });
      const action = { type: "TOGGLE_BUILD_MODE" } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.buildMode).toBe(true);
      expect(result.openPanel).toBeNull();
      expect(result.selectedWarehouseId).toBeNull();
    });

    it("TOGGLE_BUILD_MODE leaving build mode keeps openPanel/selectedWarehouseId intact", () => {
      const state = createUiState({
        buildMode: true,
        openPanel: null,
        selectedWarehouseId: null,
      });
      const action = { type: "TOGGLE_BUILD_MODE" } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.buildMode).toBe(false);
    });

    it("SELECT_BUILD_BUILDING sets the building selection and clears floor selection", () => {
      const state = createUiState({ selectedFloorTile: "stone_floor" });
      const action = {
        type: "SELECT_BUILD_BUILDING",
        buildingType: "workbench",
      } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.selectedBuildingType).toBe("workbench");
      expect(result.selectedFloorTile).toBeNull();
    });

    it("SELECT_BUILD_FLOOR_TILE sets the floor selection and clears building selection", () => {
      const state = createUiState({ selectedBuildingType: "workbench" });
      const action = {
        type: "SELECT_BUILD_FLOOR_TILE",
        tileType: "stone_floor",
      } satisfies GameAction;

      const result = expectHandled(uiContext.reduce(state, action));

      expect(result.selectedFloorTile).toBe("stone_floor");
      expect(result.selectedBuildingType).toBeNull();
    });

    it("REMOVE_FROM_HOTBAR keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createUiState();
      const action = {
        type: "REMOVE_FROM_HOTBAR",
        slot: 0,
      } satisfies GameAction;

      expect(uiContext.reduce(state, action)).toBe(state);
    });

    it("EQUIP_BUILDING_FROM_WAREHOUSE keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createUiState();
      const action = {
        type: "EQUIP_BUILDING_FROM_WAREHOUSE",
        buildingType: "workbench",
      } satisfies GameAction;

      expect(uiContext.reduce(state, action)).toBe(state);
    });

    it("EQUIP_FROM_WAREHOUSE keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createUiState();
      const action = {
        type: "EQUIP_FROM_WAREHOUSE",
        itemKind: "axe",
      } satisfies GameAction;

      expect(uiContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(uiContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(uiContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        UI_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(uiContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
