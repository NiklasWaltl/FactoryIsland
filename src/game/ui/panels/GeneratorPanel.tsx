import React from "react";
import type { GameState } from "../../store/types";
import type { GameAction } from "../../store/game-actions";
import {
  GENERATOR_ENERGY_PER_TICK,
  GENERATOR_TICK_MS,
  GENERATOR_TICKS_PER_WOOD,
} from "../../store/constants/energy/generator";
import { ENERGY_NET_TICK_MS } from "../../store/constants/energy/energy-smelter";
import { GENERATOR_MAX_FUEL } from "../../store/constants/buildings/index";
import { getInboundBuildingSupplyAmount } from "../../drones/selection/helpers/need-slot-resolvers";
import { getConnectedConsumerDrainEntries } from "../../power/energy-consumers";
import { getEnergyProductionPerPeriod } from "../../power/energy-production";
import { getCraftingSourceInventory } from "../../crafting/crafting-sources";
import { getSourceStatusInfo } from "../../store/selectors/source-status";
import { ZoneSourceSelector } from "./ZoneSourceSelector";

interface GeneratorPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

/** Energy produced per second by one running generator */
const ENERGY_PER_SEC = Math.round(
  (GENERATOR_ENERGY_PER_TICK * 1000) / GENERATOR_TICK_MS,
);
/** Wood burned per second while running */
const WOOD_PER_SEC = (
  1000 /
  GENERATOR_TICK_MS /
  GENERATOR_TICKS_PER_WOOD
).toFixed(2);

export const GeneratorPanel: React.FC<GeneratorPanelProps> = React.memo(
  ({ state, dispatch }) => {
    const generatorId = state.selectedGeneratorId;
    const g = (generatorId && state.generators[generatorId]) || {
      fuel: 0,
      progress: 0,
      running: false,
      requestedRefill: 0,
    };
    const requestedOpen = g.requestedRefill ?? 0;
    const inboundWood = generatorId
      ? getInboundBuildingSupplyAmount(state, generatorId, "wood")
      : 0;
    const refillHeadroom = Math.max(
      0,
      GENERATOR_MAX_FUEL - g.fuel - requestedOpen,
    );

    const sourceInfo = getSourceStatusInfo(state, generatorId);
    const sourceInv = getCraftingSourceInventory(state, sourceInfo.source);
    const woodAvailable = (sourceInv.wood as number) ?? 0;

    const fuelPct = g.fuel > 0 ? (1 - g.progress) * 100 : 0;

    let blockReason: string | null = null;
    if (sourceInfo.fallbackReason === "zone_no_warehouses") {
      blockReason = "Zone aktiv, aber keine Lagerhäuser (Fallback: Global)";
    } else if (woodAvailable < 1) {
      blockReason =
        sourceInfo.source.kind === "zone"
          ? "Zone hat kein Holz"
          : sourceInfo.source.kind === "warehouse"
            ? "Lagerhaus hat kein Holz"
            : "Kein Holz im globalen Inventar";
    }

    // Connectivity info
    const genConnectedToPole = state.connectedAssetIds.some(
      (id) => state.assets[id]?.type === "power_pole",
    );
    const connectedMachines = state.connectedAssetIds
      .map((id) => state.assets[id])
      .filter(
        (a) =>
          a &&
          (a.type === "smithy" ||
            a.type === "workbench" ||
            a.type === "battery"),
      );
    const totalCables = state.cablesPlaced;

    // Energy balance as used by the scheduler: connected consumer drains per net period.
    const production = getEnergyProductionPerPeriod(state);
    const consumption = getConnectedConsumerDrainEntries(state).reduce(
      (sum, entry) => sum + entry.drain,
      0,
    );
    const netEnergy = production - consumption;

    return (
      <div
        className="fi-panel fi-generator"
        role="presentation"
        onClick={(ev) => ev.stopPropagation()}
        onKeyDown={(ev) => ev.stopPropagation()}
      >
        <h2>⚡ Holz-Generator</h2>

        {generatorId && (
          <ZoneSourceSelector
            state={state}
            buildingId={generatorId}
            dispatch={dispatch}
          />
        )}

        {blockReason && (
          <div className="fi-generator-block-reason">{blockReason}</div>
        )}

        {/* Generator status */}
        <div className="fi-generator-energy-label fi-generator-status-row">
          <span
            className={`fi-generator-power-badge ${g.running ? "fi-generator-power-badge--on" : "fi-generator-power-badge--off"}`}
          >
            {g.running
              ? "🔥 Generator läuft"
              : g.fuel > 0
                ? "⏸ Bereit"
                : "💤 Kein Brennstoff"}
          </span>
          <span
            className={`fi-debug-badge fi-generator-pole-badge ${genConnectedToPole ? "fi-debug-badge--active" : "fi-debug-badge--inactive"}`}
          >
            {genConnectedToPole
              ? "🗼 Mit Stromknoten verbunden"
              : "🗼 Kein Stromknoten"}
          </span>
        </div>

        {/* Energy output this period */}
        <div className="fi-generator-energy-bar-wrap">
          <div className="fi-generator-energy-label">
            <span>⚡ Energie-Bilanz (pro {ENERGY_NET_TICK_MS / 1000}s)</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: "bold",
                color:
                  netEnergy > 0
                    ? "#7fff7f"
                    : netEnergy < 0
                      ? "#ff8888"
                      : "#aaa",
              }}
            >
              {netEnergy > 0
                ? `+${netEnergy} J`
                : netEnergy < 0
                  ? `${netEnergy} J`
                  : "0 J"}
            </span>
          </div>
          <div className="fi-generator-balance-detail">
            <span>
              Produktion:{" "}
              <strong className="fi-generator-text-positive">
                +{production} J
              </strong>
            </span>
            <span>
              Verbrauch Maschinen:{" "}
              <strong style={{ color: consumption > 0 ? "#ff8888" : "#555" }}>
                −{consumption} J
              </strong>
            </span>
          </div>
        </div>

        {/* Network connectivity */}
        <div className="fi-generator-connectivity-row">
          🔌 Verbundene Maschinen:{" "}
          <strong
            style={{
              color: connectedMachines.length > 0 ? "#7CFF7C" : "#FF8888",
            }}
          >
            {connectedMachines.length}
          </strong>
          {" | "}Kabel verlegt: <strong>{totalCables}</strong>
        </div>

        {/* Fuel slot */}
        <div className="fi-generator-section-title">
          🪵 Brennstoff (Holz) — lokales Inventar
        </div>
        <div className="fi-smithy-slot fi-generator-fuel-slot">
          <span>Holz im Generator</span>
          <strong>
            {g.fuel} / {GENERATOR_MAX_FUEL}
          </strong>

          {g.running && g.fuel > 0 && (
            <div className="fi-generator-fuel-bar-wrap">
              <div className="fi-generator-bar-track">
                <div
                  className="fi-generator-bar-fill fi-generator-bar-fill--fuel"
                  style={{ width: `${Math.min(fuelPct, 100)}%` }}
                />
              </div>
              <div className="fi-generator-bar-meta">
                <span className="fi-generator-bar-meta-text">
                  verbleibendes Holz
                </span>
              </div>
            </div>
          )}

          {g.fuel >= GENERATOR_MAX_FUEL && (
            <div className="fi-generator-fuel-full-warning">
              Lokales Holz-Inventar voll ({GENERATOR_MAX_FUEL}/
              {GENERATOR_MAX_FUEL}).
            </div>
          )}

          {/* Manual refill request — drones deliver, no auto-refill */}
          <div className="fi-generator-refill-status">
            📦 Angefordert:{" "}
            <strong style={{ color: requestedOpen > 0 ? "#7CFF7C" : "#888" }}>
              {requestedOpen}
            </strong>
            {" · "}🚁 Unterwegs:{" "}
            <strong style={{ color: inboundWood > 0 ? "#7CFF7C" : "#888" }}>
              {inboundWood}
            </strong>
          </div>
          <div className="fi-generator-refill-buttons">
            <button
              className="fi-btn fi-btn-sm"
              disabled={refillHeadroom < 1}
              title="Drohnen liefern 1 Holz aus dem Lager / Hub"
              onClick={() =>
                dispatch({ type: "GENERATOR_REQUEST_REFILL", amount: 1 })
              }
            >
              +1 anfordern
            </button>
            <button
              className="fi-btn fi-btn-sm"
              disabled={refillHeadroom < 1}
              title="Drohnen liefern bis zu 5 Holz"
              onClick={() =>
                dispatch({ type: "GENERATOR_REQUEST_REFILL", amount: 5 })
              }
            >
              +5 anfordern
            </button>
            <button
              className="fi-btn fi-btn-sm"
              disabled={refillHeadroom < 1}
              title="Drohnen liefern bis zu 10 Holz"
              onClick={() =>
                dispatch({ type: "GENERATOR_REQUEST_REFILL", amount: 10 })
              }
            >
              +10 anfordern
            </button>
            <button
              className="fi-btn fi-btn-sm"
              disabled={refillHeadroom < 1}
              title="Drohnen füllen den Speicher bis zum Maximum"
              onClick={() =>
                dispatch({ type: "GENERATOR_REQUEST_REFILL", amount: "max" })
              }
            >
              ⛽ Bis voll
            </button>
          </div>
          {refillHeadroom < 1 &&
            (requestedOpen > 0 || g.fuel >= GENERATOR_MAX_FUEL) && (
              <div className="fi-generator-refill-locked-hint">
                {g.fuel >= GENERATOR_MAX_FUEL
                  ? "Speicher voll — keine weitere Anforderung möglich."
                  : `Bereits ${requestedOpen} Holz angefordert (deckt Restkapazität).`}
              </div>
            )}
        </div>

        {/* Controls */}
        <div className="fi-generator-section-title">⚙️ Steuerung</div>
        <div className="fi-generator-controls">
          <button
            className="fi-btn"
            disabled={g.running || g.fuel <= 0}
            onClick={() => dispatch({ type: "GENERATOR_START" })}
          >
            ▶ Starten
          </button>
          <button
            className="fi-btn fi-btn-danger"
            disabled={!g.running}
            onClick={() => dispatch({ type: "GENERATOR_STOP" })}
          >
            ⏹ Stoppen
          </button>
        </div>

        {/* Stats */}
        <div className="fi-generator-section-title">📊 Kennzahlen</div>
        <div className="fi-generator-stats">
          <div className="fi-generator-stat">
            <span>Energie-Output</span>
            <strong>+{ENERGY_PER_SEC} J/s</strong>
          </div>
          <div className="fi-generator-stat">
            <span>Holzverbrauch</span>
            <strong>{WOOD_PER_SEC} Holz/s</strong>
          </div>
          <div className="fi-generator-stat">
            <span>Reichweite</span>
            <strong>
              {g.fuel > 0
                ? `~${Math.ceil((g.fuel * GENERATOR_TICKS_PER_WOOD * GENERATOR_TICK_MS) / 1000)}s`
                : "—"}
            </strong>
          </div>
        </div>

        <div className="fi-generator-scheduler-demand">
          Scheduler-Nachfrage (verbundene Verbraucher):{" "}
          <strong style={{ color: consumption > 0 ? "#ff8888" : "#555" }}>
            −{consumption} J/2s
          </strong>
        </div>
      </div>
    );
  },
);

GeneratorPanel.displayName = "GeneratorPanel";
