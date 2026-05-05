import React, { useMemo, useState } from "react";
import type { GameState } from "../../store/types";
import { getDroneStatusDetail } from "../../store/selectors/drone-status-detail";
import { buildProductionTransparency } from "./productionTransparency";

interface ProductionStatusFeedProps {
  state: GameState;
}

const JOB_TYPE_LABEL: Record<string, string> = {
  "player-craft": "player craft",
  "keep-in-stock": "keep-in-stock",
  "automation-craft": "automation craft",
  construction: "construction",
  upgrade: "upgrade",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "queued",
  reserved: "reserved",
  crafting: "crafting",
  delivering: "delivering",
  waiting: "waiting",
};

const DECONSTRUCT_QUEUE_STATUS_LABEL: Record<string, string> = {
  open: "offen",
  reserved: "reserviert",
  active: "aktiv",
};

export const ProductionStatusFeed: React.FC<ProductionStatusFeedProps> =
  React.memo(({ state }) => {
    const [collapsed, setCollapsed] = useState(false);
    const snapshot = useMemo(() => buildProductionTransparency(state), [
      state.crafting.jobs,
      state.keepStockByWorkbench,
      state.recipeAutomationPolicies,
      state.constructionSites,
      state.drones,
      state.assets,
      state.inventory,
      state.warehouseInventories,
      state.serviceHubs,
      state.network,
      state.buildingZoneIds,
      state.buildingSourceWarehouseIds,
      state.productionZones,
    ]);
    const relevantKeepStock = useMemo(
      () =>
        snapshot.keepStock.filter(
          (row) => row.decision !== "satisfied" || row.pendingAmount > 0,
        ),
      [snapshot.keepStock],
    );

    if (
      snapshot.jobs.length === 0 &&
      relevantKeepStock.length === 0 &&
      snapshot.deconstructRequests.length === 0
    )
      return null;

    return (
      <div className="fi-production-status-feed">
        <button
          className="fi-production-status-header"
          onClick={() => setCollapsed((value) => !value)}
          title="Produktions- und Logistik-Status"
        >
          <span>Systemstatus</span>
          <span className="fi-production-status-toggle">
            {collapsed ? "▲" : "▼"}
          </span>
        </button>

        {!collapsed && (
          <div className="fi-production-status-body">
            {snapshot.jobs.length > 0 && (
              <div className="fi-production-status-section">
                <div className="fi-production-status-title">
                  Aktive Auftraege
                </div>
                <div className="fi-production-status-list">
                  {snapshot.jobs.slice(0, 8).map((row) => (
                    <div key={row.id} className="fi-production-status-entry">
                      <div className="fi-production-status-line">
                        <span className="fi-production-status-badge">
                          {JOB_TYPE_LABEL[row.type] ?? row.type}
                        </span>
                        <span className="fi-production-status-status">
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                        {row.priorityLabel && (
                          <span className="fi-production-status-priority">
                            prio: {row.priorityLabel}
                          </span>
                        )}
                      </div>
                      <div className="fi-production-status-line fi-production-status-line--sub">
                        <span>target: {row.targetLabel}</span>
                        {row.sourceLabel && (
                          <span>source: {row.sourceLabel}</span>
                        )}
                      </div>
                      {row.reason && (
                        <div className="fi-production-status-reason">
                          {row.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {relevantKeepStock.length > 0 && (
              <div className="fi-production-status-section">
                <div className="fi-production-status-title">Keep-in-stock</div>
                <div className="fi-production-status-list">
                  {relevantKeepStock.slice(0, 6).map((row) => (
                    <div key={row.id} className="fi-production-status-entry">
                      <div className="fi-production-status-line">
                        <span className="fi-production-status-badge">
                          {row.itemLabel}
                        </span>
                        <span className="fi-production-status-status">
                          {row.decision}
                        </span>
                      </div>
                      <div className="fi-production-status-line fi-production-status-line--sub">
                        <span>target: {row.targetAmount}</span>
                        <span>available: {row.availableAmount}</span>
                        <span>pending: {row.pendingAmount}</span>
                      </div>
                      <div className="fi-production-status-reason">
                        {row.decisionReason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snapshot.deconstructRequests.length > 0 && (
              <div className="fi-production-status-section">
                <div className="fi-production-status-title">
                  Deconstruct requests
                </div>
                <div className="fi-production-status-list">
                  {snapshot.deconstructRequests.slice(0, 8).map((row) => {
                    const assignedDrone = row.assignedDroneId
                      ? state.drones[row.assignedDroneId]
                      : null;
                    const droneDetail = assignedDrone
                      ? getDroneStatusDetail(state, assignedDrone)
                      : null;

                    return (
                      <div
                        key={row.assetId}
                        className="fi-production-status-entry"
                        style={
                          row.queueStatus === "active"
                            ? {
                                borderColor: "rgba(255, 166, 77, 0.85)",
                                background: "rgba(255, 166, 77, 0.15)",
                              }
                            : undefined
                        }
                      >
                        <div className="fi-production-status-line">
                          <span className="fi-production-status-badge">
                            {row.assetType}
                          </span>
                          <span className="fi-production-status-status">
                            {DECONSTRUCT_QUEUE_STATUS_LABEL[row.queueStatus] ??
                              row.queueStatus}
                          </span>
                          {row.tickOrderIndex && (
                            <span className="fi-production-status-priority">
                              drone tick #{row.tickOrderIndex}
                            </span>
                          )}
                        </div>
                        <div className="fi-production-status-line fi-production-status-line--sub">
                          <span>asset: {row.assetId}</span>
                          <span>
                            grid: ({row.x}, {row.y})
                          </span>
                        </div>
                        {row.assignedDroneId ? (
                          <div className="fi-production-status-reason">
                            drone: {row.assignedDroneId}
                            {droneDetail ? ` (${droneDetail.label})` : ""}
                          </div>
                        ) : (
                          <div className="fi-production-status-reason">
                            noch keinem deconstruct drone zugewiesen
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  });
