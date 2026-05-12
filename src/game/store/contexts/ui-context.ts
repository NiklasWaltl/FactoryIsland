import type { GameAction } from "../game-actions";
import type { BoundedContext, UiContextState } from "./types";

export const UI_HANDLED_ACTION_TYPES = [
  "SET_ACTIVE_SLOT",
  "TOGGLE_PANEL",
  "CLOSE_PANEL",
  "TOGGLE_ENERGY_DEBUG",
  "TOGGLE_BUILD_MODE",
  "SELECT_BUILD_BUILDING",
  "SELECT_BUILD_FLOOR_TILE",
  "REMOVE_FROM_HOTBAR",
  "EQUIP_BUILDING_FROM_WAREHOUSE",
  "EQUIP_FROM_WAREHOUSE",
] as const satisfies readonly GameAction["type"][];

type UiActionType = (typeof UI_HANDLED_ACTION_TYPES)[number];
type UiAction = Extract<GameAction, { type: UiActionType }>;

const UI_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  UI_HANDLED_ACTION_TYPES,
);

function isUiAction(action: GameAction): action is UiAction {
  return UI_ACTION_TYPE_SET.has(action.type);
}

function reduceUi(state: UiContextState, action: UiAction): UiContextState {
  const actionType = action.type;

  switch (actionType) {
    case "SET_ACTIVE_SLOT":
      return {
        ...state,
        activeSlot: Math.min(
          action.slot,
          Math.max(0, state.hotbarSlots.length - 1),
        ),
      };

    case "TOGGLE_PANEL":
      return {
        ...state,
        openPanel: state.openPanel === action.panel ? null : action.panel,
      };

    case "CLOSE_PANEL":
      return {
        ...state,
        openPanel: null,
        selectedAutoMinerId: null,
        selectedAutoSmelterId: null,
        selectedAutoAssemblerId: null,
        selectedGeneratorId: null,
        selectedWarehouseId: null,
        selectedCraftingBuildingId: null,
        selectedServiceHubId: null,
        selectedSplitterId: null,
      };

    case "TOGGLE_ENERGY_DEBUG":
      return { ...state, energyDebugOverlay: !state.energyDebugOverlay };

    case "TOGGLE_BUILD_MODE": {
      const newBuildMode = !state.buildMode;
      // cross-slice: selectedBuildingType / selectedFloorTile live outside the
      // UI slice; their reset is handled by the live reducer chain.
      return {
        ...state,
        buildMode: newBuildMode,
        openPanel: newBuildMode ? null : state.openPanel,
        selectedWarehouseId: newBuildMode ? null : state.selectedWarehouseId,
      };
    }

    case "SELECT_BUILD_BUILDING":
    case "SELECT_BUILD_FLOOR_TILE":
    case "REMOVE_FROM_HOTBAR":
    case "EQUIP_BUILDING_FROM_WAREHOUSE":
    case "EQUIP_FROM_WAREHOUSE":
      // cross-slice: no-op in isolated context
      // The build-mode selectors write selectedBuildingType / selectedFloorTile
      // (not in the UI slice). Hotbar equip / remove read and write
      // state.warehouseInventories outside the UI slice.
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const uiContext: BoundedContext<UiContextState> = {
  reduce(state, action) {
    if (!isUiAction(action)) return null;
    return reduceUi(state, action);
  },
  handledActionTypes: UI_HANDLED_ACTION_TYPES,
};
