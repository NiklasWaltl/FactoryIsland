import React from "react";
import type { GameState } from "../../store/types";
import { selectModuleFragmentCount } from "../../store/selectors/module-selectors";

interface ModuleFragmentCounterProps {
  state: GameState;
}

export const ModuleFragmentCounter: React.FC<ModuleFragmentCounterProps> =
  React.memo(({ state }) => {
    const fragmentCount = selectModuleFragmentCount(state);
    if (fragmentCount <= 0) return null;

    return (
      <div
        className="fi-resource-item fi-resource-item--module-fragments"
        title="Modul-Fragmente"
      >
        <span>{"⚙️"}</span>
        <strong>{`×${fragmentCount}`}</strong>
      </div>
    );
  });

ModuleFragmentCounter.displayName = "ModuleFragmentCounter";
