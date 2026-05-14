import React, { useCallback, useMemo } from "react";
import { GRID_W, GRID_H, CELL_PX } from "../constants/grid";
import type { Direction, GameState } from "../store/types";
import {
  EnergyDebugOverlay,
  EnergyDebugHud,
} from "../ui/panels/EnergyDebugOverlay";
import { PhaserHost } from "../world/PhaserHost";
import { buildWorldOverlayData } from "./GridOverlays";
import { buildSelectionOverlays } from "./GridSelection";
import {
  selectDroneSnapshots,
  selectCollectionNodeSnapshots,
  selectShipSnapshot,
  selectFullStaticAssetSnapshots,
  selectCulledStaticAssetSnapshots,
} from "../store/selectors/phaser-snapshot-selectors";

const WORLD_W = GRID_W * CELL_PX;
const WORLD_H = GRID_H * CELL_PX;

interface GridRendererProps {
  state: GameState;
  viewportSize: { width: number; height: number };
  cam: { x: number; y: number };
  zoom: number;
  dragging: boolean;
  hover: { x: number; y: number } | null;
  buildDirection: Direction;
  warnedUnmigratedTypesRef: React.MutableRefObject<Set<string>>;
}

export const GridRenderer: React.FC<GridRendererProps> = ({
  state,
  viewportSize,
  cam,
  zoom,
  dragging,
  hover,
  buildDirection,
  warnedUnmigratedTypesRef,
}) => {
  const assetW = useCallback(
    (asset: { size: 1 | 2; width?: 1 | 2 }) => asset.width ?? asset.size,
    [],
  );
  const assetH = useCallback(
    (asset: { size: 1 | 2; height?: 1 | 2 }) => asset.height ?? asset.size,
    [],
  );

  const connectedSet = useMemo(
    () => new Set(state.connectedAssetIds),
    [state.connectedAssetIds],
  );

  const vw = viewportSize.width > 0 ? viewportSize.width : WORLD_W;
  const vh = viewportSize.height > 0 ? viewportSize.height : WORLD_H;
  const worldX1 = -cam.x / zoom;
  const worldY1 = -cam.y / zoom;
  const worldX2 = worldX1 + vw / zoom;
  const worldY2 = worldY1 + vh / zoom;
  const minCellX = Math.max(0, Math.floor(worldX1 / CELL_PX) - 1);
  const minCellY = Math.max(0, Math.floor(worldY1 / CELL_PX) - 1);
  const maxCellX = Math.min(GRID_W - 1, Math.ceil(worldX2 / CELL_PX) + 1);
  const maxCellY = Math.min(GRID_H - 1, Math.ceil(worldY2 / CELL_PX) + 1);

  const {
    migrationGuardOverlayElements,
    dynamicAssetOverlayElements,
    warehouseMarkerElements,
  } = buildWorldOverlayData({
    state,
    connectedSet,
    minCellX,
    minCellY,
    maxCellX,
    maxCellY,
    assetW,
    assetH,
    warnedUnmigratedTypesRef,
  });

  const fullStaticAssets = selectFullStaticAssetSnapshots(state);
  const stableStaticAssets = selectCulledStaticAssetSnapshots(
    fullStaticAssets,
    minCellX,
    minCellY,
    maxCellX,
    maxCellY,
  );
  const droneSnapshots = selectDroneSnapshots(state.drones);
  const collectionNodeSnapshots = selectCollectionNodeSnapshots(
    state.collectionNodes,
  );
  const shipSnapshot = selectShipSnapshot(state);

  const { placementOverlayElement, inspectionOverlayElement } =
    buildSelectionOverlays({
      state,
      hover,
      dragging,
      buildDirection,
      connectedSet,
      assetW,
      assetH,
    });

  const worldTransformStyle: React.CSSProperties = {
    position: "absolute",
    left: cam.x,
    top: cam.y,
    width: WORLD_W,
    height: WORLD_H,
    transform: `scale(${zoom})`,
    transformOrigin: "0 0",
  };

  const worldCanvasLayerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
  };

  const worldOverlayLayerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    pointerEvents: "none",
  };

  return (
    <>
      <div style={worldTransformStyle}>
        <div style={worldCanvasLayerStyle}>
          <PhaserHost
            tileMap={state.tileMap}
            floorMap={state.floorMap}
            staticAssets={stableStaticAssets}
            drones={droneSnapshots}
            collectionNodes={collectionNodeSnapshots}
            ship={shipSnapshot}
            coins={state.inventory.coins}
          />
        </div>

        <div style={worldOverlayLayerStyle}>
          {warehouseMarkerElements}
          {dynamicAssetOverlayElements}
        </div>

        {migrationGuardOverlayElements}
        {placementOverlayElement}
        {inspectionOverlayElement}

        {state.energyDebugOverlay && <EnergyDebugOverlay state={state} />}
      </div>

      {state.energyDebugOverlay && <EnergyDebugHud state={state} />}
    </>
  );
};
