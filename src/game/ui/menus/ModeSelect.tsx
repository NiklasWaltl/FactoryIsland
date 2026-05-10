import React from "react";
import type { GameMode } from "../../store/types";
import { IS_DEV } from "../../debug/debugConfig";

interface ModeSelectProps {
  onSelect: (mode: GameMode) => void;
}

export const ModeSelect: React.FC<ModeSelectProps> = ({ onSelect }) => {
  const handleDebugReset = () => {
    if (
      confirm(
        "Alle Caches clearen und neu laden? (Debug Mode wird automatisch ausgewählt)",
      )
    ) {
      localStorage.removeItem("factory-island-save");
      delete (window as any).__FI_HMR_STATE__;
      delete (window as any).__FI_HMR_MODULES__;
      location.reload();
    }
  };

  return (
    <div className="fi-mode-select-overlay">
      <div className="fi-mode-select">
        <h1>🏝️ Factory Island</h1>
        <p>Wähle einen Spielmodus:</p>
        <div className="fi-mode-buttons">
          <button
            className="fi-mode-btn fi-mode-btn--release"
            onClick={() => onSelect("release")}
          >
            <span className="fi-mode-btn-icon">🎮</span>
            <strong>Release</strong>
            <span className="fi-mode-btn-desc">
              Start mit 100 Coins. Kein Cheat.
            </span>
          </button>
          <button
            className="fi-mode-btn fi-mode-btn--debug"
            onClick={() => onSelect("debug")}
          >
            <span className="fi-mode-btn-icon">🛠️</span>
            <strong>Debug</strong>
            <span className="fi-mode-btn-desc">
              Alle Ressourcen, alle Werkzeuge, freies Testen.
            </span>
          </button>
        </div>
        {IS_DEV && (
          <div className="fi-mode-dev-tools">
            <p className="fi-mode-dev-tools-label">🧪 Dev-Tools:</p>
            <button
              onClick={handleDebugReset}
              className="fi-mode-dev-reset-btn"
            >
              🔁 HMR + Cache Clear + Debug
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
