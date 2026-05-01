import React, { type ReactNode } from "react";
import { GRID_W, GRID_H, CELL_PX } from "../../constants/grid";
import { POWER_POLE_RANGE } from "../../store/constants/energy/power-pole";

type RangeRenderableAsset = {
  id: string;
  x: number;
  y: number;
  size: 1 | 2;
  width?: 1 | 2;
  height?: 1 | 2;
};

export function collectPowerPoleRangeHighlightElements(
  assets: Record<string, RangeRenderableAsset>,
  assetW: (asset: { size: 1 | 2; width?: 1 | 2 }) => 1 | 2,
  assetH: (asset: { size: 1 | 2; height?: 1 | 2 }) => 1 | 2,
  poleX: number,
  poleY: number,
  options?: {
    excludeAssetId?: string;
    getBorderColor?: (assetId: string) => string;
    keyPrefix?: string;
  },
): ReactNode[] {
  const highlightElements: ReactNode[] = [];
  for (const asset of Object.values(assets)) {
    if (options?.excludeAssetId && asset.id === options.excludeAssetId)
      continue;
    let inRange = false;
    for (let cy = 0; cy < assetH(asset) && !inRange; cy++) {
      for (let cx = 0; cx < assetW(asset) && !inRange; cx++) {
        const dx = Math.abs(asset.x + cx - poleX);
        const dy = Math.abs(asset.y + cy - poleY);
        if (Math.max(dx, dy) <= POWER_POLE_RANGE) inRange = true;
      }
    }
    if (!inRange) continue;
    highlightElements.push(
      React.createElement("div", {
        key: `${options?.keyPrefix ?? "range"}-${asset.id}`,
        style: {
          position: "absolute",
          left: asset.x * CELL_PX + 2,
          top: asset.y * CELL_PX + 2,
          width: assetW(asset) * CELL_PX - 4,
          height: assetH(asset) * CELL_PX - 4,
          border: `2px dashed ${options?.getBorderColor?.(asset.id) ?? "rgba(255, 200, 0, 0.8)"}`,
          borderRadius: 6,
          zIndex: 9,
          pointerEvents: "none",
        },
      }),
    );
  }
  return highlightElements;
}

export function renderPowerPoleRangeArea(
  poleX: number,
  poleY: number,
  colors: { background: string; border: string },
  key?: string,
): ReactNode {
  const rx1 = Math.max(0, poleX - POWER_POLE_RANGE);
  const ry1 = Math.max(0, poleY - POWER_POLE_RANGE);
  const rx2 = Math.min(GRID_W - 1, poleX + POWER_POLE_RANGE);
  const ry2 = Math.min(GRID_H - 1, poleY + POWER_POLE_RANGE);
  const rangeW = rx2 - rx1 + 1;
  const rangeH = ry2 - ry1 + 1;

  return React.createElement("div", {
    key,
    style: {
      position: "absolute",
      left: rx1 * CELL_PX,
      top: ry1 * CELL_PX,
      width: rangeW * CELL_PX,
      height: rangeH * CELL_PX,
      background: colors.background,
      border: `2px dashed ${colors.border}`,
      borderRadius: 8,
      zIndex: 8,
      pointerEvents: "none",
    },
  });
}
