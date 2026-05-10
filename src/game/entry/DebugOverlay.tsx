import React from "react";
import { IS_DEV, DebugPanel } from "../debug";
import type { MockAction } from "../debug";
import { DevSceneSelector } from "../dev";
import type { GameMode } from "../store/types";

interface DebugOverlayProps {
  mode: GameMode;
  hmrState: { modules: string[]; status: string };
  onMock: (action: MockAction["type"]) => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  mode,
  hmrState,
  onMock,
}) => {
  if (!IS_DEV || mode !== "debug") return null;
  return (
    <>
      <DevSceneSelector mode={mode} />
      <div className="fi-debug-badge">DEBUG MODE</div>
      <DebugPanel
        onMock={onMock}
        onResetState={() => onMock("DEBUG_RESET_STATE")}
        hmrStatus={hmrState.status}
        hmrModules={hmrState.modules}
      />
    </>
  );
};
