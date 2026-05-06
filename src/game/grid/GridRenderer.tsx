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
  getDockWarehouseInputTile,
  getDockWarehousePos,
} from "../store/constants/map/map-layout";

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
    phaserStaticAssets,
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

  const staticAssetsSignature = phaserStaticAssets
    .map(
      (asset) =>
        `${asset.id}|${asset.type}|${asset.x}|${asset.y}|${asset.width}|${asset.height}|${asset.direction ?? ""}|${asset.isUnderConstruction ? 1 : 0}|${asset.isDeconstructing ? 1 : 0}`,
    )
    .join(";");
  const stableStaticAssets = useMemo(
    () => phaserStaticAssets,
    [staticAssetsSignature],
  );

  const droneSignature = Object.values(state.drones)
    .map(
      (drone) =>
        `${drone.droneId}|${drone.status}|${drone.tileX}|${drone.tileY}|${drone.hubId ?? ""}|${drone.cargo?.itemType ?? ""}|${drone.cargo?.amount ?? 0}`,
    )
    .join(";");

  const droneSnapshots = useMemo(() => {
    return Object.values(state.drones).map((drone) => ({
      droneId: drone.droneId,
      status: drone.status,
      tileX: drone.tileX,
      tileY: drone.tileY,
      cargo: drone.cargo
        ? { itemType: drone.cargo.itemType, amount: drone.cargo.amount }
        : null,
      hubId: drone.hubId,
      isParkedAtHub: drone.status === "idle" && drone.hubId !== null,
      parkingSlot: null as number | null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droneSignature]);

  const collectionNodeSignature = Object.values(state.collectionNodes)
    .map(
      (node) =>
        `${node.id}|${node.itemType}|${node.amount}|${node.tileX}|${node.tileY}`,
    )
    .join(";");

  const collectionNodeSnapshots = useMemo(() => {
    return Object.values(state.collectionNodes).map((node) => ({
      id: node.id,
      itemType: node.itemType,
      amount: node.amount,
      tileX: node.tileX,
      tileY: node.tileY,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionNodeSignature]);

  const shipSnapshot = useMemo(() => {
    const dockPos = getDockWarehousePos(state.tileMap);
    const dockInputTile = getDockWarehouseInputTile(state.tileMap);
    return {
      status: state.ship.status,
      dockTileX: dockPos.x,
      dockTileY: dockPos.y,
      inputTileX: dockInputTile.x,
      inputTileY: dockInputTile.y,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ship.status, state.tileMap]);

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
