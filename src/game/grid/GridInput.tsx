import React, { useRef, useState, useCallback, useEffect } from "react";
import { GRID_W, GRID_H, CELL_PX } from "../constants/grid";
import { getInitialCameraFocusPoint } from "../world/camera-focus";
import { cellKey } from "../store/utils/cell-key";
import type { Direction, GameState } from "../store/types";
import type { GameAction } from "../store/game-actions";

const WORLD_W = GRID_W * CELL_PX;
const WORLD_H = GRID_H * CELL_PX;

export interface UseGridInputResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportSize: { width: number; height: number };
  cam: { x: number; y: number };
  zoom: number;
  dragging: boolean;
  hover: { x: number; y: number } | null;
  buildDirection: Direction;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onGridMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function useGridInput(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
): UseGridInputResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const didDrag = useRef(false);
  const [buildDirection, setBuildDirection] = useState<Direction>("east");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const clampCam = useCallback((cx: number, cy: number, z: number) => {
    const el = containerRef.current;
    if (!el) return { x: cx, y: cy };
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const maxX = 0;
    const maxY = 0;
    const minX = -(WORLD_W * z - vw);
    const minY = -(WORLD_H * z - vh);
    return {
      x: Math.min(maxX, Math.max(minX, cx)),
      y: Math.min(maxY, Math.max(minY, cy)),
    };
  }, []);

  const updateViewportSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const nextSize = { width: el.clientWidth, height: el.clientHeight };
    setViewportSize((prev) =>
      prev.width === nextSize.width && prev.height === nextSize.height
        ? prev
        : nextSize,
    );
  }, []);

  useEffect(() => {
    updateViewportSize();
    const el = containerRef.current;
    if (!el) return;

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateViewportSize);
    observer?.observe(el);
    window.addEventListener("resize", updateViewportSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateViewportSize);
    };
  }, [updateViewportSize]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setDragging(true);
      didDrag.current = false;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        camX: cam.x,
        camY: cam.y,
      };
    },
    [cam],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      const newCam = clampCam(
        dragStart.current.camX + dx,
        dragStart.current.camY + dy,
        zoom,
      );
      setCam(newCam);
    },
    [dragging, zoom, clampCam],
  );

  const onMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(3, Math.max(0.3, zoom * factor));

      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - cam.x) / zoom;
      const wy = (my - cam.y) / zoom;
      const nx = mx - wx * newZoom;
      const ny = my - wy * newZoom;
      const clamped = clampCam(nx, ny, newZoom);
      setZoom(newZoom);
      setCam(clamped);
    },
    [zoom, cam, clampCam],
  );

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDrag.current) return;
      if (state.openPanel) {
        dispatch({ type: "CLOSE_PANEL" });
        return;
      }
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - cam.x) / zoom;
      const wy = (my - cam.y) / zoom;
      const gx = Math.floor(wx / CELL_PX);
      const gy = Math.floor(wy / CELL_PX);
      const slot = state.hotbarSlots[state.activeSlot];
      const hotbarBuildingType =
        slot?.toolKind === "building" ? slot.buildingType : null;
      if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
        if (state.buildMode && state.selectedBuildingType) {
          dispatch({
            type: "BUILD_PLACE_BUILDING",
            x: gx,
            y: gy,
            direction: buildDirection,
          });
        } else if (!state.buildMode && hotbarBuildingType) {
          dispatch({
            type: "BUILD_PLACE_BUILDING",
            x: gx,
            y: gy,
            direction: buildDirection,
          });
        } else if (state.buildMode && state.selectedFloorTile) {
          dispatch({ type: "BUILD_PLACE_FLOOR_TILE", x: gx, y: gy });
        } else {
          dispatch({ type: "CLICK_CELL", x: gx, y: gy });
        }
      }
    },
    [
      cam,
      zoom,
      state.openPanel,
      state.buildMode,
      state.selectedBuildingType,
      state.selectedFloorTile,
      state.hotbarSlots,
      state.activeSlot,
      buildDirection,
      dispatch,
    ],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!state.buildMode) return;
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - cam.x) / zoom;
      const wy = (my - cam.y) / zoom;
      const gx = Math.floor(wx / CELL_PX);
      const gy = Math.floor(wy / CELL_PX);
      if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
        const assetId = state.cellMap[cellKey(gx, gy)];
        if (assetId) {
          const targetAsset = state.assets[assetId];
          if (targetAsset?.status === "deconstructing") {
            dispatch({ type: "CANCEL_DECONSTRUCT_ASSET", assetId });
          } else {
            dispatch({ type: "REQUEST_DECONSTRUCT_ASSET", assetId });
          }
        }
      }
    },
    [cam, zoom, state.buildMode, state.cellMap, state.assets, dispatch],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const focus = getInitialCameraFocusPoint(state.tileMap);
    const cx = vw / 2 - focus.x;
    const cy = vh / 2 - focus.y;
    setCam(clampCam(cx, cy, 1));
  }, [clampCam, state.tileMap]);

  const handleRotateKey = useCallback((e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement)?.tagName === "INPUT" ||
      (e.target as HTMLElement)?.tagName === "TEXTAREA"
    ) {
      return;
    }
    if (e.key === "r" || e.key === "R") {
      const cycle: Direction[] = ["north", "east", "south", "west"];
      setBuildDirection((prev) => {
        const idx = cycle.indexOf(prev);
        return cycle[(idx + 1) % 4];
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleRotateKey);
    return () => window.removeEventListener("keydown", handleRotateKey);
  }, [handleRotateKey]);

  const onGridMouseMove = useCallback(
    (e: React.MouseEvent) => {
      onMouseMove(e);
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - cam.x) / zoom;
      const wy = (my - cam.y) / zoom;
      const gx = Math.floor(wx / CELL_PX);
      const gy = Math.floor(wy / CELL_PX);
      setHover((prev) =>
        prev && prev.x === gx && prev.y === gy ? prev : { x: gx, y: gy },
      );
    },
    [onMouseMove, cam, zoom],
  );

  return {
    containerRef,
    viewportSize,
    cam,
    zoom,
    dragging,
    hover,
    buildDirection,
    onMouseDown,
    onMouseMove,
    onGridMouseMove,
    onMouseUp,
    onWheel,
    onClick,
    onContextMenu,
  };
}
