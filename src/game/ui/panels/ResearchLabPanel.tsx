// ============================================================
// Research Lab panel — item-based building unlocks (instant).
// ------------------------------------------------------------
// Successor to the coin-based "Gebäude" section that used to
// live in MapShopPanel. Lists every RESEARCH_RECIPES entry
// grouped by tier with cost/affordability information and a
// "Forschen" button that dispatches RESEARCH_BUILDING.
// ============================================================

import React from "react";
import type { GameAction } from "../../store/game-actions";
import type { GameState, Inventory } from "../../store/types";
import {
  RESEARCH_RECIPES,
  type ResearchRecipe,
} from "../../simulation/recipes/research-recipes";
import {
  RESOURCE_EMOJIS,
  RESOURCE_LABELS,
} from "../../store/constants/resources";
import { ASSET_EMOJIS, ASSET_LABELS } from "../../store/constants/ui/assets";

export interface ResearchLabStateSlice {
  readonly inventory: GameState["inventory"];
  readonly unlockedBuildings: GameState["unlockedBuildings"];
}

interface ResearchLabPanelProps {
  state: ResearchLabStateSlice;
  dispatch: React.Dispatch<GameAction>;
}

function canAfford(inv: Inventory, cost: ResearchRecipe["cost"]): boolean {
  for (const [key, amt] of Object.entries(cost)) {
    if (((inv as unknown as Record<string, number>)[key] ?? 0) < (amt ?? 0)) {
      return false;
    }
  }
  return true;
}

function missingResources(
  inv: Inventory,
  cost: ResearchRecipe["cost"],
): string[] {
  const missing: string[] = [];
  for (const [key, amt] of Object.entries(cost)) {
    const have = (inv as unknown as Record<string, number>)[key] ?? 0;
    const need = amt ?? 0;
    if (have < need) {
      const label = RESOURCE_LABELS[key] ?? key;
      missing.push(`${label} ${have}/${need}`);
    }
  }
  return missing;
}

export const ResearchLabPanel: React.FC<ResearchLabPanelProps> = React.memo(
  ({ state, dispatch }) => {
    const tier1 = RESEARCH_RECIPES.filter((r) => r.tier === 1);
    const tier2 = RESEARCH_RECIPES.filter((r) => r.tier === 2);
    const tier3 = RESEARCH_RECIPES.filter((r) => r.tier === 3);

    const close = () => dispatch({ type: "CLOSE_PANEL" });

    const renderRecipe = (recipe: ResearchRecipe): React.ReactNode => {
      const alreadyUnlocked = state.unlockedBuildings.includes(
        recipe.buildingType,
      );
      const affordable = canAfford(state.inventory, recipe.cost);
      const missing = alreadyUnlocked
        ? []
        : missingResources(state.inventory, recipe.cost);

      const disabledReason = alreadyUnlocked
        ? "Bereits freigeschaltet"
        : !affordable
          ? `Fehlt: ${missing.join(", ")}`
          : undefined;

      return (
        <div key={recipe.id} className="fi-shop-item">
          <div className="fi-shop-item-icon">
            {ASSET_EMOJIS[recipe.buildingType]}
          </div>
          <div className="fi-shop-item-info">
            <strong>{ASSET_LABELS[recipe.buildingType]}</strong>
            <div className="fi-shop-item-costs">
              {Object.entries(recipe.cost).map(([key, amt]) => (
                <span key={key} className="fi-shop-cost">
                  {RESOURCE_EMOJIS[key] ?? ""} {amt}{" "}
                  {RESOURCE_LABELS[key] ?? key}
                </span>
              ))}
            </div>
          </div>
          {alreadyUnlocked ? (
            <span
              className="fi-build-status fi-build-status--placed"
              style={{ minWidth: 140, textAlign: "center" }}
            >
              Bereits freigeschaltet
            </span>
          ) : (
            <button
              className="fi-btn"
              disabled={!affordable}
              title={disabledReason}
              onClick={() =>
                dispatch({
                  type: "RESEARCH_BUILDING",
                  recipeId: recipe.id,
                })
              }
            >
              Forschen
            </button>
          )}
        </div>
      );
    };

    const renderTier = (
      label: string,
      recipes: readonly ResearchRecipe[],
    ): React.ReactNode => (
      <>
        <h4 className="fi-panel-section-subtitle" style={{ marginTop: 8 }}>
          {label}
        </h4>
        <div className="fi-shop-list">{recipes.map(renderRecipe)}</div>
      </>
    );

    return (
      <div
        className="fi-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 360, maxWidth: 480 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>🔬 Forschungslabor</h2>
          <button
            className="fi-btn fi-btn-sm"
            onClick={close}
            aria-label="Schließen"
          >
            X
          </button>
        </div>

        <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
          Forsche neue Gebäude per Sofort-Forschung. Verbraucht die unten
          angegebenen Items aus deinem globalen Inventar.
        </p>

        {renderTier("Tier 1 — Energie & Schmieden", tier1)}
        {renderTier("Tier 2 — Automation", tier2)}
        {renderTier("Tier 3 — Logistik & Module", tier3)}
      </div>
    );
  },
);

ResearchLabPanel.displayName = "ResearchLabPanel";
