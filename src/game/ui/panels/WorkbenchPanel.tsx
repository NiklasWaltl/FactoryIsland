import React from "react";
import type { GameState, Inventory } from "../../store/types";
import type { GameAction } from "../../store/game-actions";
import {
  RESOURCE_LABELS,
  RESOURCE_EMOJIS,
} from "../../store/constants/resources";
import { getSourceStatusInfo } from "../../store/selectors/source-status";
import { getCraftingSourceInventory } from "../../crafting/crafting-sources";
import { WORKBENCH_RECIPES } from "../../simulation/recipes";
import { getJobsForWorkbench, sortByPriorityFifo } from "../../crafting/queue";
import type { CraftingJob, JobStatus } from "../../crafting/types";
import { ZoneSourceSelector } from "./ZoneSourceSelector";
import {
  computeIngredientLines,
  summarizeAvailability,
  type IngredientLine,
} from "./helpers";

interface WorkbenchPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const STATUS_ICON: Record<string, string> = {
  available: "✓",
  reserved: "⚠",
  missing_manual: "⛏",
  missing_craftable: "⚙",
  missing_unknown: "✗",
};

const STATUS_COLOR: Record<string, string> = {
  available: "#7fd28a",
  reserved: "#e8a946",
  missing_manual: "#f08a4b",
  missing_craftable: "#7cb3f5",
  missing_unknown: "#f66",
};

function ingredientStatusKey(line: IngredientLine): keyof typeof STATUS_ICON {
  if (line.status !== "missing") return line.status;
  return `missing_${line.missingHint ?? "unknown"}` as keyof typeof STATUS_ICON;
}

function ingredientHintText(line: IngredientLine): string {
  if (line.status === "available") return "verfügbar";
  if (line.status === "reserved")
    return `${line.reserved} reserviert (von anderem Job blockiert)`;
  if (line.missingHint === "manual") return "manuell abbauen";
  if (line.missingHint === "craftable")
    return "über Produktionskette herstellbar";
  return "nicht verfügbar";
}

const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  queued: "wartet",
  reserved: "reserviert",
  crafting: "läuft",
  delivering: "liefert",
  done: "fertig",
  cancelled: "abgebrochen",
};

const PRIORITY_LABEL: Record<"high" | "normal" | "low", string> = {
  high: "hoch",
  normal: "normal",
  low: "niedrig",
};

function isReorderable(status: JobStatus): boolean {
  return status === "queued" || status === "reserved";
}

function isCancellable(status: JobStatus): boolean {
  return status !== "delivering" && status !== "done" && status !== "cancelled";
}

interface JobQueueRowProps {
  job: CraftingJob;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dispatch: React.Dispatch<GameAction>;
}

const JobQueueRow: React.FC<JobQueueRowProps> = ({
  job,
  canMoveUp,
  canMoveDown,
  dispatch,
}) => {
  const recipe = WORKBENCH_RECIPES.find((r) => r.key === job.recipeId);
  const reorderable = isReorderable(job.status);
  const cancellable = isCancellable(job.status);
  const btn = (
    enabled: boolean,
    label: string,
    title: string,
    onClick: () => void,
  ) => (
    <button
      type="button"
      className="fi-workbench-queue-btn"
      disabled={!enabled}
      title={title}
      onClick={onClick}
    >
      {label}
    </button>
  );
  return (
    <div className="fi-workbench-queue-row">
      <span className="fi-workbench-queue-icon">{recipe?.emoji ?? "•"}</span>
      <span className="fi-workbench-queue-label">
        {recipe?.label ?? job.recipeId}
        <span className="fi-workbench-queue-meta">
          {JOB_STATUS_LABEL[job.status]} · {PRIORITY_LABEL[job.priority]}
        </span>
      </span>
      {btn(reorderable && canMoveUp, "↑", "Nach oben", () =>
        dispatch({ type: "JOB_MOVE", jobId: job.id, direction: "up" }),
      )}
      {btn(reorderable && canMoveDown, "↓", "Nach unten", () =>
        dispatch({ type: "JOB_MOVE", jobId: job.id, direction: "down" }),
      )}
      {btn(
        reorderable && job.priority !== "high",
        "⏫",
        "Priorisieren (top + high)",
        () => dispatch({ type: "JOB_MOVE", jobId: job.id, direction: "top" }),
      )}
      {btn(cancellable, "✕", "Abbrechen", () =>
        dispatch({ type: "JOB_CANCEL", jobId: job.id }),
      )}
    </div>
  );
};

export const WorkbenchPanel: React.FC<WorkbenchPanelProps> = React.memo(
  ({ state, dispatch }) => {
    const buildingId = state.selectedCraftingBuildingId;
    const info = getSourceStatusInfo(state, buildingId);
    const sourceInv: Inventory = getCraftingSourceInventory(state, info.source);

    const wbJobs = buildingId
      ? getJobsForWorkbench(state.crafting, buildingId)
      : [];
    const sortedJobs = sortByPriorityFifo(wbJobs).filter(
      (j) => j.status !== "done" && j.status !== "cancelled",
    );
    const reorderableSorted = sortedJobs.filter((j) => isReorderable(j.status));

    return (
      <div
        className="fi-panel fi-workbench"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>🔨 Werkbank</h2>
        <p className="fi-workbench-intro">
          Manuelle Werkzeug-Station. Fertige Werkzeuge landen im verbundenen
          Lagerhaus und werden per Hotbar entnommen.
        </p>

        {/* ---- Source / Zone selector ---- */}
        <ZoneSourceSelector
          state={state}
          buildingId={buildingId}
          dispatch={dispatch}
        />

        {sortedJobs.length > 0 && (
          <div className="fi-workbench-queue-section">
            <div className="fi-workbench-queue-heading">
              Warteschlange ({sortedJobs.length})
            </div>
            <div className="fi-workbench-queue-list">
              {sortedJobs.map((job) => {
                const reorderIdx = reorderableSorted.findIndex(
                  (j) => j.id === job.id,
                );
                const canMoveUp = reorderIdx > 0;
                const canMoveDown =
                  reorderIdx >= 0 && reorderIdx < reorderableSorted.length - 1;
                return (
                  <JobQueueRow
                    key={job.id}
                    job={job}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    dispatch={dispatch}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="fi-shop-list">
          {WORKBENCH_RECIPES.map((recipe) => {
            const hasPhysicalSource = info.source.kind !== "global";
            const lines = computeIngredientLines(
              state,
              recipe,
              info.source,
              sourceInv,
            );
            const availability = summarizeAvailability(lines);
            const canQueue = hasPhysicalSource && availability.canCraft;

            let blockReason: string | null = null;
            if (!hasPhysicalSource) {
              blockReason = "Werkbank braucht physisches Lager";
            } else if (info.fallbackReason === "zone_no_warehouses") {
              blockReason = "Zone hat keine Lagerhäuser";
            } else if (!availability.canCraft) {
              if (availability.worstStatus === "reserved") {
                blockReason = "Zutaten durch andere Jobs reserviert";
              } else {
                const missingLines = lines.filter(
                  (l) => l.status === "missing",
                );
                const hasManual = missingLines.some(
                  (l) => l.missingHint === "manual",
                );
                const hasCraftable = missingLines.some(
                  (l) => l.missingHint === "craftable",
                );
                if (hasManual && hasCraftable)
                  blockReason =
                    "Fehlende Zutaten: manuell sammeln + produzieren";
                else if (hasManual)
                  blockReason = "Fehlende Rohstoffe – manuell abbauen";
                else if (hasCraftable)
                  blockReason =
                    "Vorprodukte fehlen – über Produktionskette herstellen";
                else blockReason = "Zutaten fehlen";
              }
            }

            return (
              <div key={recipe.key} className="fi-shop-item">
                <div className="fi-shop-item-icon">{recipe.emoji}</div>
                <div className="fi-shop-item-info">
                  <strong>{recipe.label}</strong>
                  <div className="fi-shop-item-costs fi-workbench-ingredients">
                    {lines.map((line) => {
                      const key = ingredientStatusKey(line);
                      const color = STATUS_COLOR[key];
                      const icon = STATUS_ICON[key];
                      const hint = ingredientHintText(line);
                      return (
                        <span
                          key={line.resource}
                          className="fi-shop-cost fi-workbench-ingredient"
                          style={{ color }}
                          title={hint}
                        >
                          <span className="fi-workbench-ingredient-icon">
                            {icon}
                          </span>
                          <span>{RESOURCE_EMOJIS[line.resource] ?? ""}</span>
                          <span>
                            {RESOURCE_LABELS[line.resource] ?? line.resource}
                          </span>
                          <span className="fi-workbench-ingredient-qty">
                            {line.stored}/{line.required}
                            {line.reserved > 0
                              ? ` (${line.reserved} res.)`
                              : ""}
                          </span>
                          <span className="fi-workbench-ingredient-hint">
                            {hint}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  className="fi-btn"
                  disabled={!canQueue}
                  onClick={() =>
                    buildingId &&
                    dispatch({
                      type: "JOB_ENQUEUE",
                      recipeId: recipe.key,
                      workbenchId: buildingId,
                      priority: "high",
                      source: "player",
                    })
                  }
                >
                  Craft
                </button>
                {!canQueue && blockReason && (
                  <div className="fi-workbench-block-reason">{blockReason}</div>
                )}
              </div>
            );
          })}
        </div>
        <hr className="fi-workbench-divider" />
        <p className="fi-workbench-footer-hint">
          Entfernen nur im Bau-Modus (Rechtsklick).
        </p>
      </div>
    );
  },
);

WorkbenchPanel.displayName = "WorkbenchPanel";
