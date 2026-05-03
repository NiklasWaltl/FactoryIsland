import React, { useEffect, useRef } from "react";
import type { Module } from "../../modules/module.types";
import type { GameState, Inventory, MachinePriority } from "../../store/types";
import type { GameAction } from "../../store/game-actions";
import { RESOURCE_LABELS } from "../../store/constants/resources";
import { AUTO_MINER_PRODUCE_TICKS } from "../../store/constants/drone/drone-config";
import {
  DEFAULT_MACHINE_PRIORITY,
  ENERGY_DRAIN,
} from "../../store/constants/energy/energy-balance";
import { AUTO_MINER_BOOST_MULTIPLIER } from "../../store/constants/energy/boost-multipliers";
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
import { ZoneSourceSelector } from "./ZoneSourceSelector";

interface AutoMinerPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const MODULE_TYPE_LABELS: Record<Module["type"], string> = {
  "miner-boost": "Miner Boost",
  "smelter-boost": "Smelter Boost",
};

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
    data-testid="auto-miner-module-slot"
    style={{
      display: "grid",
      gap: 8,
      borderTop: "1px solid rgba(255,255,255,0.12)",
      paddingTop: 10,
      marginTop: 2,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
      }}
    >
      <strong>🔩 Modul-Slot</strong>
      {!equippedModule && (
        <span style={{ fontSize: 12, color: "#9ca3af" }}>[Leer]</span>
      )}
    </div>

    {equippedModule ? (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
          }}
        >
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
      <div style={{ fontSize: 12, color: "#9ca3af" }}>
        Keine Module verfügbar — im Modul-Labor craften
      </div>
    ) : (
      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          Verfügbare Module:
        </span>
        {freeModules.map((module) => (
          <div
            key={module.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span>{getModuleDisplayName(module)}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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

export const AutoMinerPanel: React.FC<AutoMinerPanelProps> = React.memo(
  ({ state, dispatch }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const minerId = state.selectedAutoMinerId;
    const minerAsset = minerId ? state.assets[minerId] : null;
    const minerState = minerId ? state.autoMiners[minerId] : null;

    useEffect(() => {
      const onDocumentMouseDown = (event: MouseEvent) => {
        const panelEl = panelRef.current;
        if (!panelEl) return;
        if (event.target instanceof Node && panelEl.contains(event.target))
          return;
        dispatch({ type: "CLOSE_PANEL" });
      };
      document.addEventListener("mousedown", onDocumentMouseDown);
      return () =>
        document.removeEventListener("mousedown", onDocumentMouseDown);
    }, [dispatch]);

    if (
      !minerId ||
      !minerAsset ||
      minerAsset.type !== "auto_miner" ||
      !minerState
    ) {
      return null;
    }

    const isConnected = (state.connectedAssetIds ?? []).includes(minerId);
    const powerRatio = Math.max(
      0,
      Math.min(
        1,
        state.machinePowerRatio?.[minerId] ??
          ((state.poweredMachineIds ?? []).includes(minerId) ? 1 : 0),
      ),
    );
    const currentPriority = (minerAsset.priority ??
      DEFAULT_MACHINE_PRIORITY) as MachinePriority;

    const sourceInfo = getSourceStatusInfo(state, minerId);
    const sourceInv = getCraftingSourceInventory(state, sourceInfo.source);
    const resKey = minerState.resource as keyof Inventory;
    const currentInTarget = (sourceInv[resKey] as number) ?? 0;
    const sourceCapacity =
      sourceInfo.source.kind === "global"
        ? getCapacityPerResource(state)
        : sourceInfo.source.kind === "zone"
          ? getZoneItemCapacity(state, sourceInfo.source.zoneId)
          : state.mode === "debug"
            ? Infinity
            : WAREHOUSE_CAPACITY;
    const isOutputBlocked = currentInTarget >= sourceCapacity;
    const isReadyToOutput = minerState.progress >= AUTO_MINER_PRODUCE_TICKS;

    let blockReason: string | null = null;
    if (!isConnected || powerRatio < 1) {
      blockReason = "Keine volle Stromversorgung";
    } else if (sourceInfo.fallbackReason === "zone_no_warehouses") {
      blockReason = "Zone aktiv, aber keine Lagerhäuser (Fallback aktiv)";
    } else if (isReadyToOutput && isOutputBlocked) {
      blockReason = "Output-Ziel hat keinen Platz";
    }

    const powerLabel = !isConnected
      ? "Nicht verbunden"
      : powerRatio <= 0
        ? "Kein Strom"
        : powerRatio >= 1
          ? "Hat Strom"
          : `Reduzierte Leistung (${Math.round(powerRatio * 100)}%)`;

    const powerColor =
      !isConnected || powerRatio <= 0
        ? "#ff6b6b"
        : powerRatio >= 1
          ? "#7CFC00"
          : "#facc15";

    const isBoosted = !!minerAsset.boosted;
    const boostFactor = isBoosted ? AUTO_MINER_BOOST_MULTIPLIER : 1;
    const itemsPerTick = boostFactor / AUTO_MINER_PRODUCE_TICKS;
    const itemsPerMinute = itemsPerTick * 60;
    const baseDrain = ENERGY_DRAIN["auto_miner"] ?? 0;
    const currentDrain = baseDrain * boostFactor;
    const equippedModule = getEquippedModule(state, minerId);
    const freeMinerModules = getFreeModulesForType(state, "miner-boost");

    return (
      <div
        ref={panelRef}
        className="fi-panel fi-auto-miner-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 120,
          right: 16,
          zIndex: 40,
          minWidth: 280,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0 }}>Auto-Miner</h2>
          <button
            className="fi-btn fi-btn-sm"
            onClick={() => dispatch({ type: "CLOSE_PANEL" })}
            aria-label="Schließen"
          >
            X
          </button>
        </div>

        <ZoneSourceSelector
          state={state}
          buildingId={minerId}
          dispatch={dispatch}
        />

        <div style={{ display: "grid", gap: 8 }}>
          {blockReason && (
            <div
              data-testid="auto-miner-block-reason"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 6,
                padding: "6px 10px",
                color: "#fca5a5",
                fontSize: 12,
              }}
            >
              ⚠ {blockReason}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Output-Ziel</span>
            <strong style={{ color: isOutputBlocked ? "#fca5a5" : undefined }}>
              {sourceInfo.sourceLabel}
            </strong>
          </div>
          {sourceInfo.fallbackReason !== "none" && (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {sourceInfo.reasonLabel}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              Output (
              {RESOURCE_LABELS[minerState.resource] ?? minerState.resource})
            </span>
            <strong style={{ color: isOutputBlocked ? "#fca5a5" : "#86efac" }}>
              {currentInTarget} /{" "}
              {sourceCapacity === Infinity ? "∞" : sourceCapacity}
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Aktive Ressource</span>
            <strong>
              {RESOURCE_LABELS[minerState.resource] ?? minerState.resource}
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Energie</span>
            <strong style={{ color: powerColor }}>{powerLabel}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Ertrag pro Minute</span>
            <strong>{itemsPerMinute.toFixed(1)} / min</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Verbrauch / Periode</span>
            <strong>{currentDrain} E</strong>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Overclocking</span>
            <button
              className="fi-btn fi-btn-sm"
              onClick={() =>
                dispatch({
                  type: "SET_MACHINE_BOOST",
                  assetId: minerId,
                  boosted: !isBoosted,
                })
              }
              style={{
                padding: "4px 10px",
                border: isBoosted
                  ? "1px solid #f59e0b"
                  : "1px solid rgba(255,255,255,0.2)",
                background: isBoosted
                  ? "rgba(245,158,11,0.2)"
                  : "rgba(100,100,100,0.15)",
                color: isBoosted ? "#fbbf24" : "#d1d5db",
                borderRadius: 4,
                cursor: "pointer",
              }}
              title={`Boost: ${AUTO_MINER_BOOST_MULTIPLIER}x Produktion, ${AUTO_MINER_BOOST_MULTIPLIER}x Verbrauch`}
            >
              {isBoosted
                ? `⚡ Boost AN (${AUTO_MINER_BOOST_MULTIPLIER}x)`
                : "Boost AUS"}
            </button>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <span>Priorität (1 = höchste, 5 = niedrigste)</span>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((p) => {
                const value = p as MachinePriority;
                const selected = currentPriority === value;
                return (
                  <button
                    key={p}
                    className="fi-btn fi-btn-sm"
                    onClick={() =>
                      dispatch({
                        type: "SET_MACHINE_PRIORITY",
                        assetId: minerId,
                        priority: value,
                      })
                    }
                    style={{
                      minWidth: 32,
                      padding: "4px 8px",
                      border: selected ? "1px solid #7CFC00" : undefined,
                      background: selected ? "rgba(124,252,0,0.15)" : undefined,
                      color: selected ? "#7CFC00" : undefined,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          <ModuleSlotSection
            assetId={minerId}
            equippedModule={equippedModule}
            freeModules={freeMinerModules}
            dispatch={dispatch}
          />
        </div>
      </div>
    );
  },
);
