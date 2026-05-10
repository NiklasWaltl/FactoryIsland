import React from "react";
import type { Module } from "../../modules/module.types";
import type { GameState, Inventory } from "../../store/types";
import type { GameAction } from "../../store/game-actions";
import {
  AUTO_SMELTER_IDLE_ENERGY_PER_SEC,
  AUTO_SMELTER_PROCESSING_ENERGY_PER_SEC,
} from "../../store/constants/energy/energy-smelter";
import { AUTO_SMELTER_BOOST_MULTIPLIER } from "../../store/constants/energy/boost-multipliers";
import { getSourceStatusInfo } from "../../store/selectors/source-status";
import {
  getEquippedModule,
  getFreeModulesForType,
} from "../../store/selectors/module-selectors";
import {
  getCapacityPerResource,
  getZoneItemCapacity,
} from "../../store/warehouse-capacity";
import { getCraftingSourceInventory } from "../../crafting/crafting-sources";
import { WAREHOUSE_CAPACITY } from "../../store/constants/buildings/index";
import { getSmeltingRecipe } from "../../simulation/recipes";
import { ZoneSourceSelector } from "./ZoneSourceSelector";
import { MODULE_TYPE_LABELS } from "../../constants/moduleLabConstants";

interface AutoSmelterPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

function getModuleDisplayName(module: Module): string {
  return `${MODULE_TYPE_LABELS[module.type]} Tier ${module.tier}`;
}

function getModuleTierBadge(module: Module): string {
  return `T${module.tier}`;
}

interface ModuleSlotSectionProps {
  assetId: string;
  equippedModule: Module | null;
  freeModules: Module[];
  dispatch: React.Dispatch<GameAction>;
}

const ModuleSlotSection: React.FC<ModuleSlotSectionProps> = ({
  assetId,
  equippedModule,
  freeModules,
  dispatch,
}) => (
  <div
    data-testid="auto-smelter-module-slot"
    className="fi-module-slot-section"
  >
    <div className="fi-module-slot-row">
      <strong>⚗️ Modul-Slot</strong>
      {!equippedModule && <span className="fi-module-slot-empty">[Leer]</span>}
    </div>

    {equippedModule ? (
      <>
        <div className="fi-module-slot-item">
          <span>{getModuleDisplayName(equippedModule)}</span>
          <strong>{getModuleTierBadge(equippedModule)} ✓ Aktiv</strong>
        </div>
        <button
          className="fi-btn fi-btn-sm"
          onClick={() =>
            dispatch({ type: "REMOVE_MODULE", moduleId: equippedModule.id })
          }
        >
          Herausnehmen
        </button>
      </>
    ) : freeModules.length === 0 ? (
      <div className="fi-module-slot-empty">
        Keine Module verfügbar — im Modul-Labor craften
      </div>
    ) : (
      <div className="fi-module-slot-list">
        <span className="fi-module-slot-empty">Verfügbare Module:</span>
        {freeModules.map((module) => (
          <div key={module.id} className="fi-module-slot-item">
            <span>{getModuleDisplayName(module)}</span>
            <div className="fi-module-slot-item-actions">
              <strong>{getModuleTierBadge(module)}</strong>
              <button
                className="fi-btn fi-btn-sm"
                onClick={() =>
                  dispatch({
                    type: "PLACE_MODULE",
                    moduleId: module.id,
                    assetId,
                  })
                }
              >
                Einsetzen
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const AutoSmelterPanel: React.FC<AutoSmelterPanelProps> = React.memo(
  ({ state, dispatch }) => {
    const smelterId = state.selectedAutoSmelterId;
    const smelterAsset = smelterId ? state.assets[smelterId] : null;
    const smelter = smelterId ? state.autoSmelters[smelterId] : null;

    if (
      !smelterId ||
      !smelterAsset ||
      smelterAsset.type !== "auto_smelter" ||
      !smelter
    ) {
      return null;
    }

    const sourceInfo = getSourceStatusInfo(state, smelterId);
    const sourceInv = getCraftingSourceInventory(state, sourceInfo.source);
    const selectedRecipe = getSmeltingRecipe(smelter.selectedRecipe);
    const inputKey = selectedRecipe?.inputItem as keyof Inventory | undefined;
    const outputKey = selectedRecipe?.outputItem as keyof Inventory | undefined;
    const requiredInput = selectedRecipe?.inputAmount ?? 0;
    const outputAmount = selectedRecipe?.outputAmount ?? 0;
    const availableInput = inputKey
      ? ((sourceInv[inputKey] as number) ?? 0)
      : 0;
    const availableOutputSpace = outputKey
      ? ((sourceInv[outputKey] as number) ?? 0)
      : 0;
    const sourceCapacity =
      sourceInfo.source.kind === "global"
        ? getCapacityPerResource(state)
        : sourceInfo.source.kind === "zone"
          ? getZoneItemCapacity(state, sourceInfo.source.zoneId)
          : state.mode === "debug"
            ? Infinity
            : WAREHOUSE_CAPACITY;
    const hasInputBatch = availableInput >= requiredInput;
    const hasOutputCapacity = outputKey
      ? availableOutputSpace + outputAmount <= sourceCapacity
      : true;

    const isBoosted = !!smelterAsset.boosted;
    const boostFactor = isBoosted ? AUTO_SMELTER_BOOST_MULTIPLIER : 1;
    const equippedModule = getEquippedModule(state, smelterId);
    const freeSmelterModules = getFreeModulesForType(state, "smelter-boost");
    const throughputPerMinute = smelter.throughputEvents.length;
    const currentEnergyPerSec =
      (smelter.status === "PROCESSING"
        ? AUTO_SMELTER_PROCESSING_ENERGY_PER_SEC
        : AUTO_SMELTER_IDLE_ENERGY_PER_SEC) * boostFactor;
    const powerRatio = state.machinePowerRatio?.[smelterId] ?? 0;
    const powerPercent = powerRatio * 100;
    const nominalEnergyPerSec = currentEnergyPerSec;
    const effectiveEnergyPerSec = currentEnergyPerSec * powerRatio;
    const effectiveSpeedPercent =
      smelter.status === "PROCESSING" ? powerPercent * boostFactor : 0;
    const recipeDisplay =
      smelter.lastRecipeInput && smelter.lastRecipeOutput
        ? `${smelter.lastRecipeInput} -> ${smelter.lastRecipeOutput}`
        : "Wartet auf Input";
    const progressPct = smelter.processing
      ? Math.max(
          0,
          Math.min(
            100,
            (smelter.processing.progressMs / smelter.processing.durationMs) *
              100,
          ),
        )
      : 0;
    const statusMeta: Record<
      string,
      { label: string; bg: string; color: string }
    > = {
      IDLE: { label: "IDLE", bg: "rgba(156,163,175,0.2)", color: "#d1d5db" },
      PROCESSING: {
        label: "PROCESSING",
        bg: "rgba(34,197,94,0.2)",
        color: "#86efac",
      },
      OUTPUT_BLOCKED: {
        label: "OUTPUT_BLOCKED",
        bg: "rgba(239,68,68,0.2)",
        color: "#fca5a5",
      },
      NO_POWER: {
        label: "NO_POWER",
        bg: "rgba(244,63,94,0.2)",
        color: "#fda4af",
      },
      MISCONFIGURED: {
        label: "MISCONFIGURED",
        bg: "rgba(245,158,11,0.2)",
        color: "#fcd34d",
      },
    };
    const currentStatus = statusMeta[smelter.status] ?? statusMeta.IDLE;
    const powerBadgeColor =
      powerPercent >= 99
        ? "#86efac"
        : powerPercent >= 50
          ? "#fcd34d"
          : "#fda4af";

    let blockReason: string | null = null;
    if (smelter.status === "NO_POWER") {
      blockReason = "Keine volle Stromversorgung";
    } else if (
      smelter.status === "OUTPUT_BLOCKED" ||
      (smelter.pendingOutput.length > 0 && !hasOutputCapacity)
    ) {
      blockReason = "Output-Ziel hat keinen Platz";
    } else if (
      !smelter.processing &&
      smelter.inputBuffer.length < requiredInput
    ) {
      blockReason = "Wartet auf Input vom Förderband";
    }

    return (
      <div className="fi-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Auto Smelter</h2>

        <ZoneSourceSelector
          state={state}
          buildingId={smelterId}
          dispatch={dispatch}
        />

        <div className="fi-machine-grid">
          <div className="fi-machine-row">
            <span>Status</span>
            <strong
              className="fi-machine-status-badge"
              style={{
                background: currentStatus.bg,
                color: currentStatus.color,
              }}
            >
              {currentStatus.label}
            </strong>
          </div>
          <div className="fi-machine-row--center">
            <span>Rezept auswählen</span>
            <div className="fi-machine-row-actions">
              <button
                className={
                  smelter.selectedRecipe === "iron"
                    ? "fi-btn fi-btn-sm--active fi-machine-recipe-btn"
                    : "fi-btn fi-btn-sm fi-machine-recipe-btn"
                }
                onClick={() =>
                  dispatch({
                    type: "AUTO_SMELTER_SET_RECIPE",
                    assetId: smelterId,
                    recipe: "iron",
                  })
                }
                style={{
                  background:
                    smelter.selectedRecipe === "iron"
                      ? "rgba(234,179,8,0.3)"
                      : "rgba(100,100,100,0.2)",
                  border:
                    smelter.selectedRecipe === "iron"
                      ? "1px solid rgba(234,179,8,0.8)"
                      : "1px solid rgba(100,100,100,0.5)",
                  color:
                    smelter.selectedRecipe === "iron" ? "#fbbf24" : "#d1d5db",
                }}
              >
                ⛏️ Eisen
              </button>
              <button
                className={
                  smelter.selectedRecipe === "copper"
                    ? "fi-btn fi-btn-sm--active fi-machine-recipe-btn"
                    : "fi-btn fi-btn-sm fi-machine-recipe-btn"
                }
                onClick={() =>
                  dispatch({
                    type: "AUTO_SMELTER_SET_RECIPE",
                    assetId: smelterId,
                    recipe: "copper",
                  })
                }
                style={{
                  background:
                    smelter.selectedRecipe === "copper"
                      ? "rgba(168,85,247,0.3)"
                      : "rgba(100,100,100,0.2)",
                  border:
                    smelter.selectedRecipe === "copper"
                      ? "1px solid rgba(168,85,247,0.8)"
                      : "1px solid rgba(100,100,100,0.5)",
                  color:
                    smelter.selectedRecipe === "copper" ? "#d8b4fe" : "#d1d5db",
                }}
              >
                🔶 Kupfer
              </button>
            </div>
          </div>
          <div className="fi-machine-row">
            <span>Rezept</span>
            <strong>{recipeDisplay}</strong>
          </div>
          <div className="fi-machine-row">
            <span>Input (Förderband-Buffer)</span>
            <strong>
              {requiredInput > 0
                ? `${smelter.inputBuffer.length} / braucht ${requiredInput}`
                : "-"}
            </strong>
          </div>
          <div className="fi-machine-row">
            <span>Output-Ziel</span>
            <strong>
              {outputKey
                ? `${availableOutputSpace}${sourceCapacity !== Infinity ? ` / ${sourceCapacity}` : " / ∞"}`
                : "-"}
            </strong>
          </div>
          <div className="fi-machine-row">
            <span>Durchsatz (60s)</span>
            <strong>{throughputPerMinute} / min</strong>
          </div>
          <div className="fi-machine-row">
            <span>Energieversorgung</span>
            <strong style={{ color: powerBadgeColor }}>
              {powerPercent.toFixed(1)}%
            </strong>
          </div>
          <div className="fi-machine-row">
            <span>Energie (Soll / Ist)</span>
            <strong>
              {nominalEnergyPerSec.toFixed(1)} /{" "}
              {effectiveEnergyPerSec.toFixed(1)} / s
            </strong>
          </div>
          <div className="fi-machine-row">
            <span>Verarbeitungsrate</span>
            <strong>{effectiveSpeedPercent.toFixed(1)}%</strong>
          </div>
          <div className="fi-machine-row">
            <span>Input-Buffer</span>
            <strong>{smelter.inputBuffer.length} / 5</strong>
          </div>
          <div className="fi-machine-row--center">
            <span>Overclocking</span>
            <button
              className={`fi-btn fi-btn-sm fi-machine-boost-btn ${isBoosted ? "fi-machine-boost-btn--on" : "fi-machine-boost-btn--off"}`}
              onClick={() =>
                dispatch({
                  type: "SET_MACHINE_BOOST",
                  assetId: smelterId,
                  boosted: !isBoosted,
                })
              }
              title={`Boost: ${AUTO_SMELTER_BOOST_MULTIPLIER}x Verarbeitung, ${AUTO_SMELTER_BOOST_MULTIPLIER}x Verbrauch`}
            >
              {isBoosted
                ? `⚡ Boost AN (${AUTO_SMELTER_BOOST_MULTIPLIER}x)`
                : "Boost AUS"}
            </button>
          </div>
          {blockReason && (
            <div
              data-testid="auto-smelter-block-reason"
              className="fi-machine-block-reason--inline"
            >
              ⚠ {blockReason}
            </div>
          )}
          <ModuleSlotSection
            assetId={smelterId}
            equippedModule={equippedModule}
            freeModules={freeSmelterModules}
            dispatch={dispatch}
          />
        </div>

        <div className="fi-machine-progress-section">
          <div className="fi-machine-progress-row">
            <span>Fortschritt</span>
            <strong>
              {smelter.processing ? `${progressPct.toFixed(0)}%` : "-"}
            </strong>
          </div>
          <div className="fi-machine-progress-track">
            <div
              className="fi-machine-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <button
          className="fi-btn fi-btn-sm fi-machine-close-btn"
          onClick={() => dispatch({ type: "CLOSE_PANEL" })}
        >
          Schließen
        </button>
      </div>
    );
  },
);

AutoSmelterPanel.displayName = "AutoSmelterPanel";
