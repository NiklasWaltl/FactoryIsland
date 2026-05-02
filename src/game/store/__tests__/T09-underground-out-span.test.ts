/// <reference types="jest" />

import { previewBuildingPlacementAtCell } from "../building-placement-preview";
import { cellKey, createInitialState, gameReducer } from "../reducer";
import type { GameState } from "../types";

function withPlacementResources(state: GameState): GameState {
  return {
    ...state,
    inventory: {
      ...state.inventory,
      wood: 999,
      stone: 999,
      iron: 999,
      copper: 999,
    },
  };
}

function clearCellForPlacement(
  state: GameState,
  x: number,
  y: number,
): GameState {
  const key = cellKey(x, y);
  const occupantId = state.cellMap[key];
  if (!occupantId) return state;

  const nextAssets = { ...state.assets };
  delete nextAssets[occupantId];

  const nextCellMap = { ...state.cellMap };
  for (const [k, id] of Object.entries(nextCellMap)) {
    if (id === occupantId) delete nextCellMap[k];
  }

  return {
    ...state,
    assets: nextAssets,
    cellMap: nextCellMap,
  };
}

function forcePlayableTile(state: GameState, x: number, y: number): GameState {
  const tileMap = state.tileMap.map((row) => [...row]);
  tileMap[y][x] = "grass";
  return { ...state, tileMap };
}

describe("T09 underground-out map-edge span", () => {
  test("preview reports ug_tunnel_span at map edge", () => {
    const base = forcePlayableTile(
      clearCellForPlacement(
        withPlacementResources(createInitialState("release")),
        0,
        10,
      ),
      0,
      10,
    );
    const result = previewBuildingPlacementAtCell(
      base,
      "conveyor_underground_out",
      0,
      10,
      "east",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ug_tunnel_span");
      expect(result.message).toContain("Untergrund-Tunnel");
    }
  });

  test("placement emits tunnel-span error notification at map edge", () => {
    const base = forcePlayableTile(
      clearCellForPlacement(
        withPlacementResources(createInitialState("release")),
        0,
        10,
      ),
      0,
      10,
    );
    const beforeCount = base.notifications.length;

    const after = gameReducer(
      {
        ...base,
        buildMode: true,
        selectedBuildingType: "conveyor_underground_out",
      },
      {
        type: "BUILD_PLACE_BUILDING",
        x: 0,
        y: 10,
        direction: "east",
      },
    );

    expect(after.notifications.length).toBeGreaterThanOrEqual(beforeCount + 1);
    const latest = after.notifications[after.notifications.length - 1];
    expect(latest.kind).toBe("error");
    expect(latest.displayName).toContain("Untergrund-Tunnel");
  });
});
