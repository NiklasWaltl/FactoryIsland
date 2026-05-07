// ============================================================
// Module Lab panel — three-tab UI for fragment crafting,
// active job tracking, and owned-module management.
// ============================================================

import React, { useEffect, useState } from "react";
import type { GameState, PlacedAsset } from "../../store/types";
import type { GameAction } from "../../store/game-actions";
import type { Module } from "../../modules/module.types";
import {
  MODULE_FRAGMENT_RECIPES,
  getModuleLabRecipe,
  getRecipeFragmentCost,
} from "../../constants/moduleLabConstants";
import {
  getCompatibleAssetsForModule,
  selectModuleFragmentCount,
} from "../../store/selectors/module-selectors";
import { MODULE_COMPATIBLE_BUILDINGS } from "../../store/action-handlers/module-compat";

interface ModulLabPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

type TabId = "fragments" | "job" | "modules";

const MODULE_TYPE_LABELS: Record<Module["type"], string> = {
  "miner-boost": "Miner-Boost",
  "smelter-boost": "Smelter-Boost",
};

const ASSET_TYPE_LABELS: Partial<Record<PlacedAsset["type"], string>> = {
  auto_miner: "Auto-Miner",
  auto_smelter: "Auto-Smelter",
};

function formatAssetLabel(asset: PlacedAsset): string {
  const typeLabel = ASSET_TYPE_LABELS[asset.type] ?? asset.type;
  return `${typeLabel} @ (${asset.x}, ${asset.y})`;
}

function formatCompatibleTypes(moduleType: Module["type"]): string {
  return MODULE_COMPATIBLE_BUILDINGS[moduleType]
    .map((type) => ASSET_TYPE_LABELS[type] ?? type)
    .join(", ");
}

function formatSeconds(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function getRemainingModuleLabMs(
  job: GameState["moduleLabJob"],
  nowMs: number,
): number {
  if (!job || job.status === "done") return 0;
  return job.startedAt + job.durationMs - nowMs;
}

export const ModulLabPanel: React.FC<ModulLabPanelProps> = React.memo(
  ({ state, dispatch }) => {
    const [activeTab, setActiveTab] = useState<TabId>("fragments");
    const [now, setNow] = useState(() => Date.now());

    const fragments = selectModuleFragmentCount(state);
    const job = state.moduleLabJob;
    const modules = state.moduleInventory ?? [];

    useEffect(() => {
      if (!job || job.status !== "crafting") return;
      const id = window.setInterval(() => setNow(Date.now()), 250);
      return () => window.clearInterval(id);
    }, [job]);

    const remainingMs = getRemainingModuleLabMs(job, now);

    const close = () => dispatch({ type: "CLOSE_PANEL" });

    return (
      <div
        className="fi-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 360, maxWidth: 460 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>🧪 Modul-Labor</h2>
          <button
            className="fi-btn fi-btn-sm"
            onClick={close}
            aria-label="Schließen"
          >
            X
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          <TabButton
            active={activeTab === "fragments"}
            onClick={() => setActiveTab("fragments")}
            label="Fragmente"
          />
          <TabButton
            active={activeTab === "job"}
            onClick={() => setActiveTab("job")}
            label="Aktiver Job"
            badge={job ? "•" : undefined}
          />
          <TabButton
            active={activeTab === "modules"}
            onClick={() => setActiveTab("modules")}
            label="Meine Module"
            badge={modules.length > 0 ? String(modules.length) : undefined}
          />
        </div>

        {activeTab === "fragments" && (
          <FragmentsTab
            fragmentCount={fragments}
            jobActive={job !== null}
            dispatch={dispatch}
          />
        )}

        {activeTab === "job" && (
          <JobTab job={job} remainingMs={remainingMs} dispatch={dispatch} />
        )}

        {activeTab === "modules" && (
          <ModulesTab modules={modules} state={state} dispatch={dispatch} />
        )}
      </div>
    );
  },
);

ModulLabPanel.displayName = "ModulLabPanel";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  active,
  onClick,
  label,
  badge,
}) => (
  <button
    onClick={onClick}
    className="fi-btn fi-btn-sm"
    style={{
      flex: 1,
      background: active ? "#9333ea" : undefined,
      color: active ? "#fff" : undefined,
    }}
  >
    {label}
    {badge ? ` (${badge})` : ""}
  </button>
);

interface FragmentsTabProps {
  fragmentCount: number;
  jobActive: boolean;
  dispatch: React.Dispatch<GameAction>;
}

const FragmentsTab: React.FC<FragmentsTabProps> = ({
  fragmentCount,
  jobActive,
  dispatch,
}) => (
  <div>
    <div style={{ marginBottom: 12, fontSize: 14 }}>
      🧩 Modul-Fragmente: <strong>{fragmentCount}</strong>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {MODULE_FRAGMENT_RECIPES.map((recipe) => {
        const cost = getRecipeFragmentCost(recipe);
        const canCraft = !jobActive && fragmentCount >= cost;
        const reason = jobActive
          ? "Job läuft bereits"
          : fragmentCount < cost
            ? `Benötigt ${cost} Fragmente`
            : null;
        return (
          <div
            key={recipe.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              background: "rgba(147,51,234,0.08)",
              border: "1px solid rgba(147,51,234,0.4)",
              borderRadius: 6,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Tier {recipe.outputTier}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {cost} Fragmente · {Math.round(recipe.durationMs / 1000)}s ·{" "}
                {MODULE_TYPE_LABELS[recipe.outputModuleType]}
              </div>
            </div>
            <button
              className="fi-btn"
              disabled={!canCraft}
              onClick={() =>
                dispatch({ type: "START_MODULE_CRAFT", recipeId: recipe.id })
              }
              title={reason ?? undefined}
            >
              Craften
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

interface JobTabProps {
  job: GameState["moduleLabJob"];
  remainingMs: number;
  dispatch: React.Dispatch<GameAction>;
}

const JobTab: React.FC<JobTabProps> = ({ job, remainingMs, dispatch }) => {
  if (!job) {
    return (
      <div style={{ opacity: 0.6, fontStyle: "italic" }}>
        Kein aktiver Job. Starte einen Craft im Tab Fragmente.
      </div>
    );
  }

  const recipe = getModuleLabRecipe(job.recipeId);
  const total = job.durationMs;
  const elapsed = total - Math.max(0, remainingMs);
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        🔨 Tier-{job.tier}-Modul wird gecraftet
        {recipe ? ` (${MODULE_TYPE_LABELS[job.moduleType]})` : ""}
      </div>
      <div
        style={{
          height: 14,
          background: "rgba(147,51,234,0.15)",
          border: "1px solid rgba(147,51,234,0.4)",
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background:
              job.status === "done"
                ? "#22c55e"
                : "linear-gradient(90deg,#a855f7,#9333ea)",
            transition: "width 0.4s linear",
          }}
        />
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
        {job.status === "done"
          ? "Bereit zur Abholung"
          : `${formatSeconds(remainingMs)} verbleibend · ${job.fragmentsRequired} Fragmente investiert`}
      </div>

      {job.status === "done" ? (
        <button
          className="fi-btn"
          onClick={() => dispatch({ type: "COLLECT_MODULE" })}
          style={{ width: "100%", background: "#22c55e", color: "#fff" }}
        >
          ✅ Modul einsammeln
        </button>
      ) : (
        <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic" }}>
          Hinweis: Investierte Fragmente werden bei Abbruch nicht
          zurückerstattet (siehe GDD).
        </div>
      )}
    </div>
  );
};

interface ModulesTabProps {
  modules: Module[];
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const ModulesTab: React.FC<ModulesTabProps> = ({
  modules,
  state,
  dispatch,
}) => {
  if (modules.length === 0) {
    return (
      <div style={{ opacity: 0.6, fontStyle: "italic" }}>
        Noch keine Module gecraftet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {modules.map((m) => {
        const placedAsset = m.equippedTo ? state.assets[m.equippedTo] : null;
        const placedLabel = placedAsset
          ? `Platziert in ${formatAssetLabel(placedAsset)}`
          : "Frei";
        const compatibleAssets = m.equippedTo
          ? []
          : getCompatibleAssetsForModule(state, m.type);
        return (
          <div
            key={m.id}
            data-testid={`module-row-${m.id}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "6px 10px",
              background: "rgba(147,51,234,0.06)",
              border: "1px solid rgba(147,51,234,0.3)",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  Tier {m.tier} — {MODULE_TYPE_LABELS[m.type]}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{placedLabel}</div>
              </div>
              {m.equippedTo && (
                <button
                  className="fi-btn fi-btn-sm"
                  onClick={() =>
                    dispatch({ type: "REMOVE_MODULE", moduleId: m.id })
                  }
                >
                  Ausbauen
                </button>
              )}
            </div>
            {!m.equippedTo &&
              (compatibleAssets.length === 0 ? (
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  Kein freies kompatibles Gebäude (benötigt:{" "}
                  {formatCompatibleTypes(m.type)})
                </div>
              ) : (
                <div style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>
                    Einsetzen in:
                  </span>
                  {compatibleAssets.map((asset) => (
                    <div
                      key={asset.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 12 }}>
                        {formatAssetLabel(asset)}
                      </span>
                      <button
                        className="fi-btn fi-btn-sm"
                        onClick={() =>
                          dispatch({
                            type: "PLACE_MODULE",
                            moduleId: m.id,
                            assetId: asset.id,
                          })
                        }
                      >
                        Einsetzen
                      </button>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
};
