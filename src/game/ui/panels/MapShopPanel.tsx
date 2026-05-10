import React from "react";
import type { GameAction } from "../../store/game-actions";
import type { MapShopStateSlice } from "../../store/types/ui-slice-types";
import { MAP_SHOP_ITEMS } from "../../store/constants/ui/shop";
import { RESOURCE_EMOJIS } from "../../store/constants/resources";

interface MapShopPanelProps {
  state: MapShopStateSlice;
  dispatch: React.Dispatch<GameAction>;
}

export const MapShopPanel: React.FC<MapShopPanelProps> = React.memo(
  ({ state, dispatch }) => {
    return (
      <div
        className="fi-panel fi-map-shop"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2>🧑‍🌾 Händler</h2>

        {/* --- Werkzeuge --- */}
        <h3 className="fi-panel-section-title">🛠️ Werkzeuge</h3>
        <div className="fi-shop-list">
          {MAP_SHOP_ITEMS.map((item) => {
            const canAfford = state.coins >= item.costCoins;
            return (
              <div key={item.key} className="fi-shop-item">
                <div className="fi-shop-item-icon">{item.emoji}</div>
                <div className="fi-shop-item-info">
                  <strong>{item.label}</strong>
                  <div className="fi-shop-item-costs">
                    <span className="fi-shop-cost">
                      {RESOURCE_EMOJIS.coins} {item.costCoins} Coins
                    </span>
                  </div>
                </div>
                <button
                  className="fi-btn"
                  disabled={!canAfford}
                  onClick={() =>
                    dispatch({ type: "BUY_MAP_SHOP_ITEM", itemKey: item.key })
                  }
                >
                  Kaufen
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ color: "#777", fontSize: 12, marginTop: 16 }}>
          Gebäude freischalten → Research Lab bauen.
        </p>

        <p style={{ color: "#888", fontSize: 12, marginTop: 12 }}>
          Du hast {RESOURCE_EMOJIS.coins} {state.coins} Coins
        </p>
      </div>
    );
  },
);

MapShopPanel.displayName = "MapShopPanel";
