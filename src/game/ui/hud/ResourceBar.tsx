import React from "react";
import { RESOURCE_EMOJIS } from "../../store/constants/resources";
import type { Inventory } from "../../store/types";
import type { HudStateSlice } from "../../store/types/ui-slice-types";
import { getCapacityPerResource } from "../../store/warehouse-capacity";
import { selectGlobalInventoryView } from "../../store/helpers/inventory-queries";

interface ResourceBarProps {
  state: HudStateSlice;
}

/** Resources shown in the compact HUD — excludes tools and building items. */
const CORE_RESOURCES: (keyof Inventory)[] = [
  "wood",
  "stone",
  "iron",
  "copper",
  "ironIngot",
  "copperIngot",
];

export const ResourceBar: React.FC<ResourceBarProps> = React.memo(
  ({ state }) => {
    const cap = getCapacityPerResource(state);
    const capLabel = cap === Infinity ? "∞" : String(cap);
    // Phase 1: HUD reads the derived view so warehouse + hub stocks are visible.
    const inventoryView = selectGlobalInventoryView(state);
    const fragmentCount = state.moduleFragments;

    return (
      <div className="fi-resource-bar">
        {/* Coins — no capacity cap */}
        <div className="fi-resource-item fi-resource-item--coins">
          <span>{RESOURCE_EMOJIS["coins"]}</span>
          <strong>{inventoryView.coins}</strong>
        </div>

        {/* Core resources with capacity indicator */}
        {CORE_RESOURCES.map((key) => {
          const amount = inventoryView[key] as number;
          const atCap = cap !== Infinity && amount >= cap;
          const nearCap = !atCap && cap !== Infinity && amount >= cap * 0.9;
          return (
            <div
              key={key}
              className={`fi-resource-item${
                atCap
                  ? " fi-resource-item--full"
                  : nearCap
                    ? " fi-resource-item--near"
                    : ""
              }`}
            >
              <span>{RESOURCE_EMOJIS[key] ?? "📦"}</span>
              <strong>{amount}</strong>
              {cap !== Infinity && (
                <span className="fi-resource-cap">/{capLabel}</span>
              )}
            </div>
          );
        })}

        {fragmentCount > 0 && (
          <div
            className="fi-resource-item fi-resource-item--module-fragments"
            title="Modul-Fragmente"
          >
            <span>{"⚙️"}</span>
            <strong>{`×${fragmentCount}`}</strong>
          </div>
        )}
      </div>
    );
  },
);
