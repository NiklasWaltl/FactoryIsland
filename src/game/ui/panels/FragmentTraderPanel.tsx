import React, { useEffect, useRef, useState } from "react";
import type { GameState } from "../../store/types";
import type { GameAction } from "../../store/game-actions";
import { RESOURCE_EMOJIS } from "../../store/constants/resources";
import { selectModuleCount } from "../../store/selectors/module-selectors";
import {
  FRAGMENT_TRADER_PITY_COST,
  getFragmentTraderCostForShipsSinceLastFragment,
  MODULE_FRAGMENT_ITEM_ID,
  PITY_THRESHOLD,
} from "../../ship/ship-constants";

interface FragmentTraderPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const FEEDBACK_CLOSE_DELAY_MS = 1_500;

export const FragmentTraderPanel: React.FC<FragmentTraderPanelProps> = React.memo(
  ({ state, dispatch }) => {
    const [purchaseConfirmed, setPurchaseConfirmed] = useState(false);
    const closeTimerRef = useRef<number | null>(null);

    useEffect(() => {
      return () => {
        if (closeTimerRef.current !== null) {
          window.clearTimeout(closeTimerRef.current);
        }
      };
    }, []);

    const shipsSinceLastFragment = state.ship.shipsSinceLastFragment;
    const cost = getFragmentTraderCostForShipsSinceLastFragment(
      shipsSinceLastFragment,
    );
    const discountActive = shipsSinceLastFragment >= PITY_THRESHOLD;
    const remainingShipsForDiscount = Math.max(
      0,
      PITY_THRESHOLD - shipsSinceLastFragment,
    );
    const moduleCount = selectModuleCount(state);
    const canAfford = state.inventory.coins >= cost;
    const canBuy = canAfford && !purchaseConfirmed;
    const buttonLabel = discountActive
      ? `Kaufen — ${cost} ${RESOURCE_EMOJIS.coins} (Rabatt!)`
      : `Kaufen — ${cost} ${RESOURCE_EMOJIS.coins}`;

    const handleBuy = () => {
      if (!canBuy) return;
      dispatch({ type: "BUY_FRAGMENT" });
      setPurchaseConfirmed(true);
      closeTimerRef.current = window.setTimeout(() => {
        dispatch({ type: "CLOSE_PANEL" });
      }, FEEDBACK_CLOSE_DELAY_MS);
    };

    return (
      <div
        className="fi-panel fi-fragment-trader-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fi-fragment-trader-header">
          <h2>⚓ Fragment-Händler</h2>
          <button
            className="fi-btn fi-btn-sm"
            onClick={() => dispatch({ type: "CLOSE_PANEL" })}
            aria-label="Schließen"
          >
            X
          </button>
        </div>

        <div className="fi-fragment-trader-coins">
          <span>Deine Coins:</span>
          <strong>
            {RESOURCE_EMOJIS.coins} {state.inventory.coins}
          </strong>
        </div>

        <div className="fi-fragment-trader-count">
          Fragmente im Inventar: <strong>{moduleCount}</strong>
        </div>

        <div className="fi-fragment-trader-offer">
          <div className="fi-fragment-trader-icon">
            {RESOURCE_EMOJIS[MODULE_FRAGMENT_ITEM_ID] ?? "⚙️"}
          </div>
          <div className="fi-fragment-trader-offer-copy">
            <strong>Modul-Fragment</strong>
            <span>Tausche Coins gegen ein garantiertes Modul-Fragment.</span>
          </div>
        </div>

        <button
          className="fi-btn fi-fragment-trader-buy"
          disabled={!canBuy}
          onClick={handleBuy}
        >
          {buttonLabel}
        </button>

        {shipsSinceLastFragment > 0 && !discountActive && (
          <p className="fi-fragment-trader-pity">
            Pity: noch {remainingShipsForDiscount} Schiffe bis Rabattpreis {" "}
            {FRAGMENT_TRADER_PITY_COST} {RESOURCE_EMOJIS.coins}
          </p>
        )}

        {purchaseConfirmed && (
          <div className="fi-fragment-trader-feedback">Fragment erhalten! ✓</div>
        )}
      </div>
    );
  },
);
