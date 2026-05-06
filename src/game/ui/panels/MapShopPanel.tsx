import React from "react";
import type { GameAction } from "../../store/game-actions";
import type { MapShopStateSlice } from "../../store/types/ui-slice-types";
import {
  MAP_SHOP_BUILDING_UNLOCKS,
  MAP_SHOP_ITEMS,
} from "../../store/constants/ui/shop";
import { RESOURCE_EMOJIS } from "../../store/constants/resources";

interface MapShopPanelProps {
  state: MapShopStateSlice;
  dispatch: React.Dispatch<GameAction>;
}

export const MapShopPanel: React.FC<MapShopPanelProps> = React.memo(
  ({ state, dispatch }) => {
    const tier1 = MAP_SHOP_BUILDING_UNLOCKS.filter((u) => u.tier === 1);
    const tier2 = MAP_SHOP_BUILDING_UNLOCKS.filter((u) => u.tier === 2);
    const tier3 = MAP_SHOP_BUILDING_UNLOCKS.filter((u) => u.tier === 3);

    const renderBuildingTier = (
      label: string,
      offers: typeof MAP_SHOP_BUILDING_UNLOCKS,
    ): React.ReactNode => (
      <>
        <h4 className="fi-panel-section-subtitle" style={{ marginTop: 8 }}>
          {label}
        </h4>
        <div className="fi-shop-list">
          {offers.map((offer) => {
            const alreadyUnlocked = state.unlockedBuildings.includes(
              offer.buildingType,
            );
            const canAfford = state.coins >= offer.costCoins;
            return (
              <div key={offer.buildingType} className="fi-shop-item">
                <div className="fi-shop-item-icon">{offer.emoji}</div>
                <div className="fi-shop-item-info">
                  <strong>{offer.label}</strong>
                  <div className="fi-shop-item-costs">
                    <span className="fi-shop-cost">
                      {RESOURCE_EMOJIS.coins} {offer.costCoins} Coins
                    </span>
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
                    disabled={!canAfford}
                    onClick={() =>
                      dispatch({
                        type: "BUY_BUILDING_UNLOCK",
                        buildingType: offer.buildingType,
                      })
                    }
                  >
                    Freischalten
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </>
    );

    return (
      <div
        className="fi-panel fi-map-shop"
        onClick={(e) => e.stopPropagation()}
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

        {/* --- Gebäude --- */}
        <h3 className="fi-panel-section-title" style={{ marginTop: 16 }}>
          🏗️ Gebäude
        </h3>
        {renderBuildingTier("Tier 1 — Energie & Schmieden", tier1)}
        {renderBuildingTier("Tier 2 — Automation", tier2)}
        {renderBuildingTier("Tier 3 — Logistik & Module", tier3)}

        <p style={{ color: "#777", fontSize: 11, marginTop: 12 }}>
          Freigeschaltete Gebäude können über das Bau-Menü (B) platziert werden.
        </p>

        <p style={{ color: "#888", fontSize: 12, marginTop: 12 }}>
          Du hast {RESOURCE_EMOJIS.coins} {state.coins} Coins
        </p>
      </div>
    );
  },
);

MapShopPanel.displayName = "MapShopPanel";
