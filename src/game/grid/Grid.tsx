import React, { useRef } from "react";
import type { GameAction } from "../store/game-actions";
import type { GameState } from "../store/types";
import { useGridInput } from "./GridInput";
import { GridRenderer } from "./GridRenderer";

interface GridProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export const Grid: React.FC<GridProps> = ({ state, dispatch }) => {
  const warnedUnmigratedTypesRef = useRef<Set<string>>(new Set());
  const {
    containerRef,
    viewportSize,
    cam,
    zoom,
    dragging,
    hover,
    buildDirection,
    onMouseDown,
    onGridMouseMove,
    onMouseUp,
    onClick,
    onContextMenu,
  } = useGridInput(state, dispatch);

  return (
    <div
      ref={containerRef}
      className="fi-grid-container"
      role="application"
      aria-label="Spielfeld"
      tabIndex={-1}
      onMouseDown={onMouseDown}
      onMouseMove={onGridMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={onClick}
      onKeyDown={() => {}}
      onContextMenu={onContextMenu}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        cursor: dragging ? "grabbing" : "grab",
        background: "#1a3a1a",
      }}
    >
      <GridRenderer
        state={state}
        viewportSize={viewportSize}
        cam={cam}
        zoom={zoom}
        dragging={dragging}
        hover={hover}
        buildDirection={buildDirection}
        warnedUnmigratedTypesRef={warnedUnmigratedTypesRef}
      />
    </div>
  );
};
