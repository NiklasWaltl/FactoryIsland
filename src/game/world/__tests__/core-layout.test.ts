import { GRID_H, GRID_W } from "../../constants/grid";
import { getInitialCameraFocusTile } from "../camera-focus";
import {
  START_AREA_FIXED_RESOURCE_CLEARANCE_TILES,
  getCorePlayableBounds,
  getStartAreaAnchor,
  getStartAreaBounds,
  isBoundsInsideBounds,
  isInsideCoreArea,
  isInsideStartArea,
  type TileBounds,
} from "../core-layout";
import {
  FIXED_RESOURCE_FOOTPRINT_SIZE,
  FIXED_RESOURCE_LAYOUT,
} from "../fixed-resource-layout";
import { generateIslandTileMap, isPlayableTile } from "../island-generator";

describe("core island layout", () => {
  const tileMap = generateIslandTileMap(GRID_H, GRID_W);

  it("derives a fully playable inner core", () => {
    const core = getCorePlayableBounds(tileMap);

    expect(core).toEqual({ row: 11, col: 11, width: 58, height: 28 });
    forEachCell(core, (row, col) => {
      expect(isPlayableTile(tileMap[row][col])).toBe(true);
    });
  });

  it("places the deterministic start area inside the core", () => {
    const core = getCorePlayableBounds(tileMap);
    const startArea = getStartAreaBounds(tileMap);

    expect(startArea).toEqual({ row: 20, col: 32, width: 16, height: 10 });
    expect(isBoundsInsideBounds(startArea, core)).toBe(true);
    forEachCell(startArea, (row, col) => {
      expect(isInsideCoreArea(row, col, tileMap)).toBe(true);
      expect(isPlayableTile(tileMap[row][col])).toBe(true);
    });
  });

  it("keeps the start area clear of fixed 2x2 resource deposits", () => {
    const startArea = getStartAreaBounds(tileMap);

    for (const origin of FIXED_RESOURCE_LAYOUT) {
      const protectedDepositBounds = expandBounds(
        {
          row: origin.row,
          col: origin.col,
          width: FIXED_RESOURCE_FOOTPRINT_SIZE,
          height: FIXED_RESOURCE_FOOTPRINT_SIZE,
        },
        START_AREA_FIXED_RESOURCE_CLEARANCE_TILES,
      );

      expect(boundsOverlap(startArea, protectedDepositBounds)).toBe(false);
    }
  });

  it("returns a deterministic valid start anchor", () => {
    const anchor = getStartAreaAnchor(tileMap);

    expect(anchor).toEqual({ row: 25, col: 40 });
    expect(isInsideStartArea(anchor.row, anchor.col, tileMap)).toBe(true);
    expect(isInsideCoreArea(anchor.row, anchor.col, tileMap)).toBe(true);
    expect(isPlayableTile(tileMap[anchor.row][anchor.col])).toBe(true);
  });

  it("uses a valid world tile for initial camera focus", () => {
    const focus = getInitialCameraFocusTile(tileMap);

    expect(focus.row).toBeGreaterThanOrEqual(0);
    expect(focus.row).toBeLessThan(GRID_H);
    expect(focus.col).toBeGreaterThanOrEqual(0);
    expect(focus.col).toBeLessThan(GRID_W);
    expect(isInsideCoreArea(focus.row, focus.col, tileMap)).toBe(true);
    expect(isPlayableTile(tileMap[focus.row][focus.col])).toBe(true);
  });
});

function forEachCell(
  bounds: TileBounds,
  visit: (row: number, col: number) => void,
): void {
  for (let row = bounds.row; row < bounds.row + bounds.height; row += 1) {
    for (let col = bounds.col; col < bounds.col + bounds.width; col += 1) {
      visit(row, col);
    }
  }
}

function expandBounds(bounds: TileBounds, margin: number): TileBounds {
  return {
    row: bounds.row - margin,
    col: bounds.col - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2,
  };
}

function boundsOverlap(left: TileBounds, right: TileBounds): boolean {
  return (
    left.row < right.row + right.height &&
    left.row + left.height > right.row &&
    left.col < right.col + right.width &&
    left.col + left.width > right.col
  );
}
