// ============================================================
// Production transparency (UI / read-only mirror)
// ------------------------------------------------------------
// Builds the snapshot consumed by ProductionStatusFeed. Strictly
// read-only: never enqueues jobs, never mutates state, never
// computes its own keep-stock decisions.
//
// Keep-stock rows are derived from `evaluateKeepStockTarget`, the
// same authoritative gate the planning workflow
// (`crafting/workflows/keepStockWorkflow.ts`) uses. This module
// only translates the typed decision codes into user-facing
// strings. If the decision logic needs to change, change it in
// `crafting/keepStockDecision.ts` — both layers will follow.
// ============================================================

import {
  isKeepStockTrackedJob,
  isOpenCraftingJob,
  sortByPriorityFifo,
} from "../../crafting/queue";
import type {
  CraftingInventorySource,
  CraftingJob,
} from "../../crafting/types";
import {
  evaluateKeepStockTarget,
  listConfiguredKeepStockTargets,
  type KeepStockDecisionResult,
  type KeepStockEvaluationDeps,
} from "../../crafting/policies";
import { getCraftingSourceInventory } from "../../crafting/crafting-sources";
import { pickCraftingPhysicalSourceForIngredient } from "../../crafting/tick";
import { hasCompleteWorkbenchInput } from "../../crafting/workbench-input-complete";
import { isCollectableCraftingItem } from "../../crafting/workbench-input-buffer";
import { gatherWorkbenchInputCandidates } from "../../drones/candidates/workbench-input-candidates";
import { scoreDroneTask } from "../../drones/candidates/scoring";
import {
  getAvailableHubDispatchSupply,
  getNearbyWarehousesForDispatch,
} from "../../drones/execution/dispatch-supply";
import {
  decideAutoMinerOutputTarget,
  type AutoMinerOutputTargetDecision,
  type AutoMinerOutputSource,
} from "../../store/decisions/auto-miner-decisions";
import {
  getAssignedWorkbenchInputDroneCount,
  getWorkbenchJobInputAmount,
} from "../../drones/selection/helpers/need-slot-resolvers";
import {
  decideConveyorTargetSelection,
  decideConveyorTickEligibility,
} from "../../store/decisions/conveyor-decisions";
import { getItemCount } from "../../inventory/helpers";
import { isKnownItemId, getItemDef } from "../../items/registry";
import { RESOURCE_LABELS } from "../../store/constants/resources";
import type {
  CollectableItemType,
  ConveyorItem,
  CraftingSource,
  GameState,
} from "../../store/types";
import { roleAllows } from "../../store/types";
import {
  KEEP_STOCK_MAX_TARGET,
  KEEP_STOCK_OPEN_JOB_CAP,
} from "../../store/constants/keep-stock";
import { ENERGY_DRAIN } from "../../store/constants/energy/energy-balance";
import { isUnderConstruction } from "../../store/helpers/asset-status";
import { getOrBuildRoutingIndex } from "../../store/helpers/routing-index-cache";
import { resolveBuildingSource } from "../../store/building-source";
import { toCraftingJobInventorySource } from "../../store/crafting/crafting-source-adapters";
import {
  getCapacityPerResource,
  getWarehouseCapacity,
  getZoneItemCapacity,
} from "../../store/warehouse-capacity";
import { isValidWarehouseInput } from "../../store/warehouse-input";
import { resolveWorkbenchInputPickup } from "../../store/workbench/workbench-input-pickup";
import {
  getDeconstructRequestQueueRows,
  type DeconstructRequestQueueRow,
} from "../../store/selectors/deconstruct-request-queue";
import {
  getManualAssemblerRecipe,
  getSmeltingRecipe,
  getWorkbenchRecipe,
} from "../../simulation/recipes";
import { getAutoAssemblerV1Recipe } from "../../simulation/recipes/AutoAssemblerV1Recipes";
import {
  MODULE_FRAGMENT_RECIPES,
  getRecipeFragmentCost,
} from "../../constants/moduleLabConstants";
import { computeIngredientLines } from "../panels/helpers";

export type TransparencyJobType =
  | "player-craft"
  | "keep-in-stock"
  | "automation-craft"
  | "construction"
  | "upgrade"
  | "auto_smelter"
  | "auto_miner"
  | "smithy"
  | "generator"
  | "manual_assembler"
  | "auto_assembler"
  | "module_lab"
  | "research_lab"
  | "conveyor";

export type TransparencyJobStatus =
  | "queued"
  | "reserved"
  | "crafting"
  | "delivering"
  | "waiting";

export interface ProductionJobStatusRow {
  readonly id: string;
  readonly type: TransparencyJobType;
  readonly status: TransparencyJobStatus;
  readonly targetLabel: string;
  readonly sourceLabel?: string;
  readonly priorityLabel?: string;
  readonly reason?: string;
}

export type KeepStockDecision = "enqueue" | "skip" | "satisfied";

export interface KeepStockStatusRow {
  readonly id: string;
  readonly workbenchId: string;
  readonly recipeId: string;
  readonly itemId: string;
  readonly itemLabel: string;
  readonly targetAmount: number;
  readonly availableAmount: number;
  readonly pendingAmount: number;
  readonly decision: KeepStockDecision;
  readonly decisionReason: string;
}

export interface ProductionTransparencySnapshot {
  readonly jobs: readonly ProductionJobStatusRow[];
  readonly keepStock: readonly KeepStockStatusRow[];
  readonly deconstructRequests: readonly DeconstructRequestQueueRow[];
}

interface ProductionTransparencyInputRefs {
  readonly mode: GameState["mode"];
  readonly warehousesPlaced: GameState["warehousesPlaced"];
  readonly smithy: GameState["smithy"];
  readonly manualAssembler: GameState["manualAssembler"];
  readonly generators: GameState["generators"];
  readonly battery: GameState["battery"];
  readonly connectedAssetIds: GameState["connectedAssetIds"];
  readonly craftingJobs: GameState["crafting"]["jobs"];
  readonly keepStockByWorkbench: GameState["keepStockByWorkbench"];
  readonly recipeAutomationPolicies: GameState["recipeAutomationPolicies"];
  readonly constructionSites: GameState["constructionSites"];
  readonly autoMiners: GameState["autoMiners"];
  readonly autoSmelters: GameState["autoSmelters"];
  readonly autoAssemblers: GameState["autoAssemblers"];
  readonly moduleLabJob: GameState["moduleLabJob"];
  readonly moduleFragments: GameState["moduleFragments"];
  readonly notifications: GameState["notifications"];
  readonly conveyors: GameState["conveyors"];
  readonly collectionNodes: GameState["collectionNodes"];
  readonly drones: GameState["drones"];
  readonly assets: GameState["assets"];
  readonly poweredMachineIds: GameState["poweredMachineIds"];
  readonly machinePowerRatio: GameState["machinePowerRatio"];
  readonly inventory: GameState["inventory"];
  readonly warehouseInventories: GameState["warehouseInventories"];
  readonly serviceHubs: GameState["serviceHubs"];
  readonly network: GameState["network"];
  readonly buildingZoneIds: GameState["buildingZoneIds"];
  readonly buildingSourceWarehouseIds: GameState["buildingSourceWarehouseIds"];
  readonly productionZones: GameState["productionZones"];
}

function getProductionTransparencyInputRefs(
  state: GameState,
): ProductionTransparencyInputRefs {
  return {
    mode: state.mode,
    warehousesPlaced: state.warehousesPlaced,
    smithy: state.smithy,
    manualAssembler: state.manualAssembler,
    generators: state.generators,
    battery: state.battery,
    connectedAssetIds: state.connectedAssetIds,
    craftingJobs: state.crafting.jobs,
    keepStockByWorkbench: state.keepStockByWorkbench,
    recipeAutomationPolicies: state.recipeAutomationPolicies,
    constructionSites: state.constructionSites,
    autoMiners: state.autoMiners,
    autoSmelters: state.autoSmelters,
    autoAssemblers: state.autoAssemblers,
    moduleLabJob: state.moduleLabJob,
    moduleFragments: state.moduleFragments,
    notifications: state.notifications,
    conveyors: state.conveyors,
    collectionNodes: state.collectionNodes,
    drones: state.drones,
    assets: state.assets,
    poweredMachineIds: state.poweredMachineIds,
    machinePowerRatio: state.machinePowerRatio,
    inventory: state.inventory,
    warehouseInventories: state.warehouseInventories,
    serviceHubs: state.serviceHubs,
    network: state.network,
    buildingZoneIds: state.buildingZoneIds,
    buildingSourceWarehouseIds: state.buildingSourceWarehouseIds,
    productionZones: state.productionZones,
  };
}

function hasSameProductionTransparencyInputRefs(
  left: ProductionTransparencyInputRefs | null,
  right: ProductionTransparencyInputRefs,
): boolean {
  if (!left) return false;
  return (
    left.mode === right.mode &&
    left.warehousesPlaced === right.warehousesPlaced &&
    left.smithy === right.smithy &&
    left.manualAssembler === right.manualAssembler &&
    left.generators === right.generators &&
    left.battery === right.battery &&
    left.connectedAssetIds === right.connectedAssetIds &&
    left.craftingJobs === right.craftingJobs &&
    left.keepStockByWorkbench === right.keepStockByWorkbench &&
    left.recipeAutomationPolicies === right.recipeAutomationPolicies &&
    left.constructionSites === right.constructionSites &&
    left.autoMiners === right.autoMiners &&
    left.autoSmelters === right.autoSmelters &&
    left.autoAssemblers === right.autoAssemblers &&
    left.moduleLabJob === right.moduleLabJob &&
    left.moduleFragments === right.moduleFragments &&
    left.notifications === right.notifications &&
    left.conveyors === right.conveyors &&
    left.collectionNodes === right.collectionNodes &&
    left.drones === right.drones &&
    left.assets === right.assets &&
    left.poweredMachineIds === right.poweredMachineIds &&
    left.machinePowerRatio === right.machinePowerRatio &&
    left.inventory === right.inventory &&
    left.warehouseInventories === right.warehouseInventories &&
    left.serviceHubs === right.serviceHubs &&
    left.network === right.network &&
    left.buildingZoneIds === right.buildingZoneIds &&
    left.buildingSourceWarehouseIds === right.buildingSourceWarehouseIds &&
    left.productionZones === right.productionZones
  );
}

let lastProductionTransparencyInputs: ProductionTransparencyInputRefs | null =
  null;
let lastProductionTransparencySnapshot: ProductionTransparencySnapshot | null =
  null;

// Shared evaluator deps — read-only mirror of the values the reducer
// passes into the planning workflow. Kept locally so this UI module
// has no dependency on the JOB_TICK wiring.
const KEEP_STOCK_EVALUATION_DEPS: KeepStockEvaluationDeps = {
  KEEP_STOCK_OPEN_JOB_CAP,
  KEEP_STOCK_MAX_TARGET,
  resolveBuildingSource,
  toCraftingJobInventorySource,
  getCraftingSourceInventory,
  isUnderConstruction,
};

function toCraftingSource(source: CraftingInventorySource): CraftingSource {
  if (source.kind === "global") return { kind: "global" };
  if (source.kind === "warehouse")
    return { kind: "warehouse", warehouseId: source.warehouseId };
  return { kind: "zone", zoneId: source.zoneId };
}

function formatSourceLabel(source: CraftingInventorySource): string {
  if (source.kind === "global") return "global";
  if (source.kind === "warehouse") return `warehouse ${source.warehouseId}`;
  return `zone ${source.zoneId}`;
}

function getItemLabel(itemId: string): string {
  if (!isKnownItemId(itemId)) return itemId;
  return getItemDef(itemId)?.displayName ?? itemId;
}

function getBufferedAmount(job: CraftingJob, itemId: string): number {
  return (job.inputBuffer ?? []).reduce(
    (sum, stack) => sum + (stack.itemId === itemId ? stack.count : 0),
    0,
  );
}

function hasBufferedIngredients(job: CraftingJob): boolean {
  return job.ingredients.every(
    (ingredient) =>
      getBufferedAmount(job, ingredient.itemId) >= ingredient.count,
  );
}

function getFirstMissingIngredientLabel(job: CraftingJob): string | null {
  const missing = job.ingredients.find(
    (ingredient) =>
      getBufferedAmount(job, ingredient.itemId) < ingredient.count,
  );
  if (!missing) return null;
  return getItemLabel(missing.itemId);
}

function getNoPowerReason(state: GameState, assetId: string): string | null {
  const asset = state.assets[assetId];
  if (!asset) return null;
  if (!Object.prototype.hasOwnProperty.call(ENERGY_DRAIN, asset.type)) {
    return null;
  }
  if (state.poweredMachineIds.includes(assetId)) return null;
  return "⚡ Kein Strom";
}

function hasWorkbenchInputCandidateForJob(
  state: GameState,
  job: CraftingJob,
  drone: Parameters<typeof gatherWorkbenchInputCandidates>[1],
): boolean {
  return gatherWorkbenchInputCandidates(
    state,
    drone,
    { stickyBonus: 0 },
    {
      hasCompleteWorkbenchInput,
      isCollectableCraftingItem,
      getWorkbenchJobInputAmount,
      getAssignedWorkbenchInputDroneCount,
      resolveWorkbenchInputPickup,
      scoreDroneTask,
    },
  ).some((candidate) =>
    candidate.nodeId.startsWith(
      `workbench_input:${job.workbenchId}:${job.id}:`,
    ),
  );
}

function getNoWorkbenchInputDroneReason(
  state: GameState,
  job: CraftingJob,
): string | null {
  if (job.status !== "reserved") return null;
  if (job.inventorySource.kind === "global") return null;
  if (hasCompleteWorkbenchInput(job)) return null;

  const probeDrone = {
    droneId: "production-transparency-probe",
    tileX: 0,
    tileY: 0,
    targetNodeId: null,
  };
  if (!hasWorkbenchInputCandidateForJob(state, job, probeDrone)) return null;

  for (const drone of Object.values(state.drones)) {
    if (drone.status !== "idle") continue;
    if (!roleAllows(drone.role ?? "auto", "workbench_delivery")) continue;
    if (hasWorkbenchInputCandidateForJob(state, job, drone)) return null;
  }

  return "🚁 Keine Drohne verfügbar";
}

function getWrongZoneReason(state: GameState, job: CraftingJob): string | null {
  if (job.inventorySource.kind !== "zone") return null;

  for (const ingredient of job.ingredients) {
    const decision = pickCraftingPhysicalSourceForIngredient({
      source: job.inventorySource,
      itemId: ingredient.itemId,
      required: ingredient.count,
      warehouseInventories: state.warehouseInventories,
      serviceHubs: state.serviceHubs,
      network: state.network,
      assets: state.assets,
      preferredFromAssetId: job.workbenchId,
    });

    if (decision.status !== "missing") continue;
    if (getItemCount(state.inventory, ingredient.itemId) < ingredient.count) {
      continue;
    }

    return "❌ Falsche Zone";
  }

  return null;
}

function getAutoSmelterWrongZoneReason(
  state: GameState,
  smelterId: string,
  inputItem: string,
  inputAmount: number,
): string | null {
  if (!isKnownItemId(inputItem)) return null;

  const resolvedSource = resolveBuildingSource(state, smelterId);
  const inventorySource = toCraftingJobInventorySource(state, resolvedSource);
  if (inventorySource.kind !== "zone") return null;

  const decision = pickCraftingPhysicalSourceForIngredient({
    source: inventorySource,
    itemId: inputItem,
    required: inputAmount,
    warehouseInventories: state.warehouseInventories,
    serviceHubs: state.serviceHubs,
    network: state.network,
    assets: state.assets,
    preferredFromAssetId: smelterId,
  });

  if (decision.status !== "missing") return null;
  if (getItemCount(state.inventory, inputItem) < inputAmount) return null;

  return "❌ Falsche Zone";
}

function getAutoMinerSourceCapacity(
  state: GameState,
  source: AutoMinerOutputSource,
): number {
  if (source.kind === "global") return getCapacityPerResource(state);
  if (source.kind === "zone") return getZoneItemCapacity(state, source.zoneId);
  return getWarehouseCapacity(state.mode);
}

function isDepositAssetType(type: string): boolean {
  return (
    type === "stone_deposit" ||
    type === "iron_deposit" ||
    type === "copper_deposit"
  );
}

function getAutoMinerOutputDecision(
  state: GameState,
  minerId: string,
  outputX: number,
  outputY: number,
): AutoMinerOutputTargetDecision {
  const miner = state.autoMiners[minerId];
  const source = resolveBuildingSource(state, minerId) as AutoMinerOutputSource;
  const sourceInv = getCraftingSourceInventory(state, source);
  const sourceCapacity = getAutoMinerSourceCapacity(state, source);

  return decideAutoMinerOutputTarget({
    state,
    conveyors: state.conveyors,
    outputX,
    outputY,
    resource: miner.resource,
    source,
    sourceInv,
    sourceCapacity,
    minerId,
  });
}

function getAutoMinerWrongZoneReason(
  state: GameState,
  minerId: string,
  outputX: number,
  outputY: number,
  outputDecision: AutoMinerOutputTargetDecision,
): string | null {
  const source = resolveBuildingSource(state, minerId);
  if (source.kind !== "zone") return null;
  if (outputDecision.kind !== "no_target") return null;

  const globalDecision = decideAutoMinerOutputTarget({
    state,
    conveyors: state.conveyors,
    outputX,
    outputY,
    resource: state.autoMiners[minerId].resource,
    source: { kind: "global" },
    sourceInv: state.inventory,
    sourceCapacity: getCapacityPerResource(state),
    minerId,
  });

  return globalDecision.kind === "target" ? "❌ Falsche Zone" : null;
}

function isBatteryConnected(state: GameState): boolean {
  const batteryAsset = Object.values(state.assets).find(
    (asset) => asset.type === "battery",
  );
  if (!batteryAsset || batteryAsset.status === "deconstructing") return false;
  if (isUnderConstruction(state, batteryAsset.id)) return false;
  return state.connectedAssetIds.includes(batteryAsset.id);
}

function hasActiveEnergyConsumers(state: GameState): boolean {
  return Object.keys(state.machinePowerRatio).length > 0;
}

function hasReachableGeneratorFuelSupplier(
  state: GameState,
  generatorId: string,
): boolean {
  const generatorAsset = state.assets[generatorId];
  if (!generatorAsset || generatorAsset.type !== "generator") return false;

  const hasWoodDrop = Object.values(state.collectionNodes).some(
    (node) => node.itemType === "wood" && node.amount > 0,
  );
  if (hasWoodDrop) return true;

  const hasHubWood = Object.keys(state.serviceHubs).some(
    (hubId) => getAvailableHubDispatchSupply(state, hubId, "wood") > 0,
  );
  if (hasHubWood) return true;

  return (
    getNearbyWarehousesForDispatch(
      state,
      generatorAsset.x,
      generatorAsset.y,
      "wood",
    ).length > 0
  );
}

function getGeneratorOutputFullReason(
  state: GameState,
  generatorId: string,
): string | null {
  const generator = state.generators[generatorId];
  if (!generator?.running) return null;
  if (!state.connectedAssetIds.includes(generatorId)) return null;

  const batteryConnected = isBatteryConnected(state);
  const batteryFull = state.battery.stored >= state.battery.capacity;
  const hasConsumers = hasActiveEnergyConsumers(state);

  if (!hasConsumers && (!batteryConnected || batteryFull)) {
    return "📦 Output voll";
  }

  return null;
}

function getQueuedReason(state: GameState, job: CraftingJob): string {
  const recipe = getWorkbenchRecipe(job.recipeId);
  if (!recipe) return "wartet: recipe unknown";

  const source = toCraftingSource(job.inventorySource);
  const sourceInv = getCraftingSourceInventory(state, source);
  const lines = computeIngredientLines(state, recipe, source, sourceInv);

  const wrongZoneReason = getWrongZoneReason(state, job);
  if (wrongZoneReason) return wrongZoneReason;

  const hasReserved = lines.some((line) => line.status === "reserved");
  if (hasReserved) return "🔒 Ressource reserviert";

  const missing = lines.find((line) => line.status === "missing");
  if (missing) {
    if (missing.missingHint === "manual") {
      return `wartet auf manuelle Ressource: ${getItemLabel(missing.resource)}`;
    }
    if (missing.missingHint === "craftable") {
      return `wartet auf Vorproduktion: ${getItemLabel(missing.resource)}`;
    }
    return `wartet auf Ressource: ${getItemLabel(missing.resource)}`;
  }

  return "wartet auf Reservierung";
}

function getCraftingJobRows(state: GameState): ProductionJobStatusRow[] {
  const openJobs = sortByPriorityFifo(
    state.crafting.jobs.filter((job) => isOpenCraftingJob(job.status)),
  );

  const rows: ProductionJobStatusRow[] = [];

  for (const job of openJobs) {
    let type: TransparencyJobType;
    if (isKeepStockTrackedJob(state, job)) type = "keep-in-stock";
    else if (job.source === "player") type = "player-craft";
    else type = "automation-craft";

    let status: TransparencyJobStatus;
    let reason: string | undefined;

    if (job.status === "queued") {
      status = "queued";
      reason = getQueuedReason(state, job);
    } else if (job.status === "reserved") {
      status = "reserved";
      if (!hasBufferedIngredients(job)) {
        const missingIngredientLabel = getFirstMissingIngredientLabel(job);
        reason =
          getNoWorkbenchInputDroneReason(state, job) ??
          `⏳ Wartet auf Input: ${missingIngredientLabel ?? "?"}`;
      } else {
        const blockedByWorkbench = state.crafting.jobs.some(
          (other) =>
            other.id !== job.id &&
            other.workbenchId === job.workbenchId &&
            (other.status === "crafting" || other.status === "delivering"),
        );
        reason = blockedByWorkbench
          ? "wartet auf freie Werkbank"
          : "wartet auf Start";
      }
    } else if (job.status === "crafting") {
      status = "crafting";
      reason = "in Produktion";
    } else if (job.status === "delivering") {
      status = "delivering";
      reason = "📦 Output voll";
    } else {
      status = "waiting";
    }

    reason = getNoPowerReason(state, job.workbenchId) ?? reason;

    rows.push({
      id: `craft:${job.id}`,
      type,
      status,
      targetLabel: `workbench ${job.workbenchId}`,
      sourceLabel: formatSourceLabel(job.inventorySource),
      priorityLabel: job.priority,
      reason,
    });
  }

  return rows;
}

function countInboundConstructionDrones(
  state: GameState,
  targetId: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.deliveryTargetId !== targetId) continue;
    if (
      drone.currentTaskType !== "construction_supply" &&
      drone.currentTaskType !== "hub_dispatch"
    )
      continue;
    if (drone.status === "idle") continue;
    total += 1;
  }
  return total;
}

function getPrimaryConstructionNeed(
  remaining: Partial<Record<CollectableItemType, number>>,
): { itemType: CollectableItemType; amount: number } | null {
  const entries = Object.entries(remaining)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([itemType, amount]) => ({
      itemType: itemType as CollectableItemType,
      amount: amount ?? 0,
    }))
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        left.itemType.localeCompare(right.itemType),
    );

  return entries[0] ?? null;
}

function getConstructionRows(state: GameState): ProductionJobStatusRow[] {
  const rows: ProductionJobStatusRow[] = [];
  const siteIds = Object.keys(state.constructionSites).sort();

  for (const siteId of siteIds) {
    const site = state.constructionSites[siteId];
    const need = getPrimaryConstructionNeed(site.remaining);
    if (!need) continue;

    const inbound = countInboundConstructionDrones(state, siteId);
    const isUpgrade =
      site.buildingType === "service_hub" &&
      !!state.serviceHubs[siteId]?.pendingUpgrade;

    rows.push({
      id: `${isUpgrade ? "upgrade" : "construction"}:${siteId}`,
      type: isUpgrade ? "upgrade" : "construction",
      status: inbound > 0 ? "delivering" : "waiting",
      targetLabel: `${site.buildingType} ${siteId}`,
      priorityLabel: isUpgrade ? "high" : "normal",
      reason:
        inbound > 0
          ? `construction delivery unterwegs (${inbound})`
          : `${isUpgrade ? "upgrade" : "construction"} wartet auf ${need.amount} ${RESOURCE_LABELS[need.itemType] ?? need.itemType}`,
    });
  }

  return rows;
}

function getAutoMinerRows(state: GameState): ProductionJobStatusRow[] {
  const rows: ProductionJobStatusRow[] = [];

  for (const [minerId, miner] of Object.entries(state.autoMiners)) {
    const noPower = getNoPowerReason(state, minerId);
    const reason =
      noPower ?? (!miner.depositId ? "⛏️ Keine Zelle zugewiesen" : undefined);

    rows.push({
      id: `auto_miner:${minerId}`,
      type: "auto_miner",
      status: noPower ? "waiting" : miner.depositId ? "crafting" : "waiting",
      targetLabel: `auto miner ${minerId}`,
      sourceLabel: "global",
      reason,
    });
  }

  return rows;
}

function getGeneratorRows(state: GameState): ProductionJobStatusRow[] {
  const rows: ProductionJobStatusRow[] = [];

  for (const generatorId of Object.keys(state.generators).sort()) {
    const generator = state.generators[generatorId];
    const asset = state.assets[generatorId];
    if (!asset || asset.type !== "generator") continue;

    const resolvedSource = resolveBuildingSource(state, generatorId);
    const inventorySource = toCraftingJobInventorySource(state, resolvedSource);

    let status: TransparencyJobStatus = generator.running
      ? "crafting"
      : "waiting";
    let reason: string | undefined =
      getGeneratorOutputFullReason(state, generatorId) ?? undefined;

    if (reason === "📦 Output voll") {
      status = "delivering";
    }

    if (!reason && generator.fuel <= 0) {
      const requestedRefill = generator.requestedRefill ?? 0;
      if (
        requestedRefill > 0 &&
        !hasReachableGeneratorFuelSupplier(state, generatorId)
      ) {
        reason = "🚁 Keine Drohne verfügbar";
      } else {
        reason = `⏳ Wartet auf Input: ${getItemLabel("wood")}`;
      }
    }

    if (!reason && generator.fuel > 0 && !generator.running) {
      reason = "⚙️ Initialisiert";
    }

    rows.push({
      id: `generator:${generatorId}`,
      type: "generator",
      status,
      targetLabel: `generator ${generatorId}`,
      sourceLabel: formatSourceLabel(inventorySource),
      reason,
    });
  }

  return rows;
}

function getManualAssemblerSourceCapacity(
  state: GameState,
  source: CraftingSource,
): number {
  if (source.kind === "global") return getCapacityPerResource(state);
  if (source.kind === "zone") return getZoneItemCapacity(state, source.zoneId);
  return getWarehouseCapacity(state.mode);
}

function getManualAssemblerRows(state: GameState): ProductionJobStatusRow[] {
  const manualAssemblerId =
    Object.values(state.assets).find(
      (asset) =>
        asset.type === "manual_assembler" &&
        asset.id === state.manualAssembler.buildingId &&
        asset.status !== "deconstructing",
    )?.id ??
    Object.values(state.assets).find(
      (asset) =>
        asset.type === "manual_assembler" && asset.status !== "deconstructing",
    )?.id;

  if (!manualAssemblerId) return [];

  const rows: ProductionJobStatusRow[] = [];
  const manualAssembler = state.manualAssembler;
  const recipe = manualAssembler.recipe
    ? getManualAssemblerRecipe(manualAssembler.recipe)
    : null;
  const resolvedSource = resolveBuildingSource(state, manualAssemblerId);
  const inventorySource = toCraftingJobInventorySource(state, resolvedSource);
  const sourceInv = getCraftingSourceInventory(state, resolvedSource);

  let status: TransparencyJobStatus = manualAssembler.processing
    ? "crafting"
    : "waiting";
  let reason: string | undefined;

  if (recipe && isKnownItemId(recipe.outputItem)) {
    const sourceCapacity = getManualAssemblerSourceCapacity(
      state,
      resolvedSource,
    );
    const outputAmount = getItemCount(sourceInv, recipe.outputItem);
    if (outputAmount >= sourceCapacity) {
      reason = "📦 Output voll";
      status = "delivering";
    }
  }

  if (!reason && !recipe && !manualAssembler.processing) {
    reason = "🔧 Kein Rezept gewählt";
  }

  if (
    !reason &&
    recipe &&
    !manualAssembler.processing &&
    isKnownItemId(recipe.inputItem)
  ) {
    const inputAmount = getItemCount(sourceInv, recipe.inputItem);
    if (inputAmount < recipe.inputAmount) {
      reason =
        getAutoSmelterWrongZoneReason(
          state,
          manualAssemblerId,
          recipe.inputItem,
          recipe.inputAmount,
        ) ?? `⏳ Wartet auf Input: ${getItemLabel(recipe.inputItem)}`;
    }
  }

  rows.push({
    id: `manual_assembler:${manualAssemblerId}`,
    type: "manual_assembler",
    status,
    targetLabel: `manual assembler ${manualAssemblerId}`,
    sourceLabel: formatSourceLabel(inventorySource),
    reason,
  });

  return rows;
}

function getSmithyRows(state: GameState): ProductionJobStatusRow[] {
  const smithyId =
    Object.values(state.assets).find(
      (asset) =>
        asset.type === "smithy" &&
        asset.id === state.smithy.buildingId &&
        asset.status !== "deconstructing",
    )?.id ??
    Object.values(state.assets).find(
      (asset) => asset.type === "smithy" && asset.status !== "deconstructing",
    )?.id;

  if (!smithyId) return [];

  const rows: ProductionJobStatusRow[] = [];
  const smithy = state.smithy;
  const recipe = getSmeltingRecipe(smithy.selectedRecipe);
  const resolvedSource = resolveBuildingSource(state, smithyId);
  const inventorySource = toCraftingJobInventorySource(state, resolvedSource);

  const hasOutputBuffer =
    smithy.outputIngots > 0 || smithy.outputCopperIngots > 0;

  let status: TransparencyJobStatus = "waiting";
  if (smithy.processing) status = "crafting";
  else if (hasOutputBuffer) status = "delivering";

  let reason: string | undefined =
    getNoPowerReason(state, smithyId) ?? undefined;

  if (!reason && !smithy.processing && hasOutputBuffer) {
    reason = "📦 Output voll";
  }

  if (!reason && recipe) {
    const availableInput =
      recipe.inputItem === "iron" ? smithy.iron : smithy.copper;
    if (!smithy.processing && availableInput < recipe.inputAmount) {
      reason =
        getAutoSmelterWrongZoneReason(
          state,
          smithyId,
          recipe.inputItem,
          recipe.inputAmount,
        ) ?? `⏳ Wartet auf Input: ${getItemLabel(recipe.inputItem)}`;
    }
  }

  rows.push({
    id: `smithy:${smithyId}`,
    type: "smithy",
    status,
    targetLabel: `smithy ${smithyId}`,
    sourceLabel: formatSourceLabel(inventorySource),
    reason,
  });

  return rows;
}

function getAutoSmelterRows(state: GameState): ProductionJobStatusRow[] {
  const rows: ProductionJobStatusRow[] = [];

  for (const smelterId of Object.keys(state.autoSmelters).sort()) {
    const smelter = state.autoSmelters[smelterId];
    const asset = state.assets[smelterId];
    if (!asset || asset.type !== "auto_smelter") continue;

    const recipe = getSmeltingRecipe(smelter.selectedRecipe);
    const resolvedSource = resolveBuildingSource(state, smelterId);
    const inventorySource = toCraftingJobInventorySource(state, resolvedSource);

    let status: TransparencyJobStatus = "waiting";
    if (smelter.processing) status = "crafting";
    else if (smelter.pendingOutput.length > 0) status = "delivering";

    let reason: string | undefined =
      getNoPowerReason(state, smelterId) ?? undefined;

    if (!reason && smelter.status === "OUTPUT_BLOCKED") {
      reason = "📦 Output voll";
    }

    if (!reason && recipe) {
      const availableInput = smelter.inputBuffer.filter(
        (item) => item === recipe.inputItem,
      ).length;
      if (!smelter.processing && availableInput < recipe.inputAmount) {
        reason =
          getAutoSmelterWrongZoneReason(
            state,
            smelterId,
            recipe.inputItem,
            recipe.inputAmount,
          ) ?? `⏳ Wartet auf Input: ${getItemLabel(recipe.inputItem)}`;
      }
    }

    rows.push({
      id: `auto_smelter:${smelterId}`,
      type: "auto_smelter",
      status,
      targetLabel: `auto smelter ${smelterId}`,
      sourceLabel: formatSourceLabel(inventorySource),
      reason,
    });
  }

  return rows;
}

function getAutoAssemblerRows(state: GameState): ProductionJobStatusRow[] {
  const rows: ProductionJobStatusRow[] = [];

  for (const assemblerId of Object.keys(state.autoAssemblers).sort()) {
    const assembler = state.autoAssemblers[assemblerId];
    const asset = state.assets[assemblerId];
    if (!asset || asset.type !== "auto_assembler") continue;

    const recipe = getAutoAssemblerV1Recipe(assembler.selectedRecipe);
    const resolvedSource = resolveBuildingSource(state, assemblerId);
    const inventorySource = toCraftingJobInventorySource(state, resolvedSource);

    let status: TransparencyJobStatus = "waiting";
    if (assembler.processing) status = "crafting";
    else if (assembler.pendingOutput.length > 0) status = "delivering";

    let reason: string | undefined =
      getNoPowerReason(state, assemblerId) ?? undefined;

    if (!reason && assembler.status === "OUTPUT_BLOCKED") {
      reason = "📦 Output voll";
    }

    if (!reason && recipe && !assembler.processing) {
      if (assembler.ironIngotBuffer < recipe.inputAmount) {
        reason =
          getAutoSmelterWrongZoneReason(
            state,
            assemblerId,
            recipe.inputItem,
            recipe.inputAmount,
          ) ?? `⏳ Wartet auf Input: ${getItemLabel(recipe.inputItem)}`;
      }
    }

    rows.push({
      id: `auto_assembler:${assemblerId}`,
      type: "auto_assembler",
      status,
      targetLabel: `auto assembler ${assemblerId}`,
      sourceLabel: formatSourceLabel(inventorySource),
      reason,
    });
  }

  return rows;
}

function getConveyorRows(state: GameState): ProductionJobStatusRow[] {
  const rows: ProductionJobStatusRow[] = [];
  const routingIndex = getOrBuildRoutingIndex(state);
  const connectedSet = new Set(state.connectedAssetIds ?? []);
  const poweredSet = new Set(state.poweredMachineIds ?? []);
  const movedThisTick = new Set<string>();

  for (const conveyorId of Object.keys(state.conveyors).sort()) {
    const conveyor = state.conveyors[conveyorId];
    const asset = state.assets[conveyorId];
    if (!asset || asset.status === "deconstructing") continue;

    if (
      asset.type !== "conveyor" &&
      asset.type !== "conveyor_corner" &&
      asset.type !== "conveyor_merger" &&
      asset.type !== "conveyor_splitter" &&
      asset.type !== "conveyor_underground_in" &&
      asset.type !== "conveyor_underground_out"
    ) {
      continue;
    }

    const headItem = conveyor.queue[0] ?? null;
    let status: TransparencyJobStatus = "waiting";
    let reason: string | undefined;

    if (headItem) {
      status = "delivering";

      const preflight = decideConveyorTickEligibility({
        conveyorId,
        assets: state.assets,
        connectedSet,
        poweredSet,
        movedThisTick,
      });

      if (preflight.kind === "ready") {
        const routingDecision = decideConveyorTargetSelection({
          state,
          liveState: state,
          convId: conveyorId,
          convAsset: preflight.conveyorAsset,
          currentItem: headItem as ConveyorItem,
          conveyors: state.conveyors,
          warehouseInventories: state.warehouseInventories,
          smithy: state.smithy,
          movedThisTick,
          isValidWarehouseInput,
          resolveBuildingSource,
          getCraftingSourceInventory,
          getSourceCapacity: (liveState, source) =>
            getManualAssemblerSourceCapacity(
              liveState,
              source as CraftingSource,
            ),
          getWarehouseCapacity,
          splitterFilterState: state.splitterFilterState,
          routingIndex,
        });

        if (
          routingDecision.kind === "blocked" ||
          routingDecision.kind === "no_target"
        ) {
          reason = "📦 Output voll";
        }
      } else {
        status = "waiting";
      }
    }

    rows.push({
      id: `conveyor:${conveyorId}`,
      type: "conveyor",
      status,
      targetLabel: `${asset.type} ${conveyorId}`,
      reason,
    });
  }

  return rows;
}

function getModuleLabRows(state: GameState): ProductionJobStatusRow[] {
  const moduleLabId = Object.values(state.assets).find(
    (asset) => asset.type === "module_lab" && asset.status !== "deconstructing",
  )?.id;

  if (!moduleLabId) return [];

  const rows: ProductionJobStatusRow[] = [];
  const job = state.moduleLabJob;

  let status: TransparencyJobStatus = "waiting";
  let reason: string | undefined;

  if (job?.status === "done") {
    status = "delivering";
    reason = "📦 Output voll";
  } else if (job?.status === "crafting") {
    status = "crafting";
  } else {
    const minFragmentCost = MODULE_FRAGMENT_RECIPES.reduce(
      (min, recipe) => Math.min(min, getRecipeFragmentCost(recipe)),
      Number.POSITIVE_INFINITY,
    );

    if (
      Number.isFinite(minFragmentCost) &&
      state.moduleFragments < minFragmentCost
    ) {
      reason = "⏳ Wartet auf Input: Modul-Fragment";
    }
  }

  rows.push({
    id: `module_lab:${moduleLabId}`,
    type: "module_lab",
    status,
    targetLabel: `module lab ${moduleLabId}`,
    reason,
  });

  return rows;
}

function getResearchLabRows(state: GameState): ProductionJobStatusRow[] {
  const researchLabId = Object.values(state.assets).find(
    (asset) =>
      asset.type === "research_lab" && asset.status !== "deconstructing",
  )?.id;

  if (!researchLabId) return [];

  const hasPendingResearchConfirmation = state.notifications.some(
    (notification) => notification.resource === "research_unlock",
  );

  return [
    {
      id: `research_lab:${researchLabId}`,
      type: "research_lab",
      status: hasPendingResearchConfirmation ? "delivering" : "waiting",
      targetLabel: `research lab ${researchLabId}`,
      reason: hasPendingResearchConfirmation ? "📦 Output voll" : undefined,
    },
  ];
}

function getMachineRows(state: GameState): ProductionJobStatusRow[] {
  return [
    ...getGeneratorRows(state),
    ...getManualAssemblerRows(state),
    ...getSmithyRows(state),
    ...getAutoSmelterRows(state),
    ...getAutoAssemblerRows(state),
    ...getConveyorRows(state),
    ...getModuleLabRows(state),
    ...getResearchLabRows(state),
    ...getAutoMinerRows(state),
    // weitere folgen
  ];
}

/**
 * Map a `KeepStockDecisionResult` skip code into the wording shown in
 * the HUD. Wording is preserved 1:1 with the previous inline branches.
 * Returning `null` means "do not render a row for this target".
 */
function describeSkipReason(
  decision: Extract<KeepStockDecisionResult, { kind: "skip" }>,
): string | null {
  switch (decision.code) {
    case "disabled":
      return null;
    case "workbenchMissing":
      return null;
    case "recipeMissing":
      return "skip keep-in-stock: unsupported recipe";
    case "policyBlocked":
      return `skip keep-in-stock: ${decision.rawReason ?? "policy blocked"}`;
    case "underConstruction":
      return "skip keep-in-stock: workbench under construction";
    case "noPhysicalSource":
      return "skip keep-in-stock: no physical source";
    case "higherPriorityBlockers":
      return "skip keep-in-stock: hoeher priorisierte Jobs offen";
    case "capReached":
      return "skip keep-in-stock: global refill cap reached";
    case "refillActive":
      return "skip keep-in-stock: stock refill already active";
  }
}

function getKeepStockRows(state: GameState): KeepStockStatusRow[] {
  const rows: KeepStockStatusRow[] = [];
  const targets = listConfiguredKeepStockTargets(state);

  for (const cfg of targets) {
    const decision = evaluateKeepStockTarget(
      state,
      cfg,
      KEEP_STOCK_EVALUATION_DEPS,
      state.crafting.jobs,
    );

    const id = `${cfg.workbenchId}:${cfg.recipeId}`;

    if (decision.kind === "skip") {
      const reason = describeSkipReason(decision);
      if (reason === null) continue;
      const recipe = decision.recipe;
      rows.push({
        id,
        workbenchId: cfg.workbenchId,
        recipeId: cfg.recipeId,
        itemId: recipe?.outputItem ?? cfg.recipeId,
        itemLabel: recipe ? getItemLabel(recipe.outputItem) : cfg.recipeId,
        targetAmount: decision.targetAmount,
        availableAmount: decision.availableAmount ?? 0,
        pendingAmount: decision.pendingAmount ?? 0,
        decision: "skip",
        decisionReason: reason,
      });
      continue;
    }

    const ctx = decision.ctx;
    if (decision.kind === "satisfied") {
      rows.push({
        id,
        workbenchId: cfg.workbenchId,
        recipeId: cfg.recipeId,
        itemId: ctx.recipe.outputItem,
        itemLabel: getItemLabel(ctx.recipe.outputItem),
        targetAmount: ctx.targetAmount,
        availableAmount: ctx.availableAmount,
        pendingAmount: ctx.pendingAmount,
        decision: "satisfied",
        decisionReason: "target reached",
      });
      continue;
    }

    // decision.kind === "enqueue"
    const missing = Math.max(0, ctx.targetAmount - ctx.projectedAmount);
    rows.push({
      id,
      workbenchId: cfg.workbenchId,
      recipeId: cfg.recipeId,
      itemId: ctx.recipe.outputItem,
      itemLabel: getItemLabel(ctx.recipe.outputItem),
      targetAmount: ctx.targetAmount,
      availableAmount: ctx.availableAmount,
      pendingAmount: ctx.pendingAmount,
      decision: "enqueue",
      decisionReason: `enqueue keep-in-stock for ${ctx.recipe.outputItem} amount ${missing}`,
    });
  }

  return rows;
}

export function buildProductionTransparency(
  state: GameState,
): ProductionTransparencySnapshot {
  const nextInputs = getProductionTransparencyInputRefs(state);
  if (
    hasSameProductionTransparencyInputRefs(
      lastProductionTransparencyInputs,
      nextInputs,
    ) &&
    lastProductionTransparencySnapshot
  ) {
    return lastProductionTransparencySnapshot;
  }

  const jobs = [
    ...getCraftingJobRows(state),
    ...getConstructionRows(state),
    ...getMachineRows(state),
  ];

  const REASON_PRIORITY = (reason: string | undefined): number => {
    if (!reason) return 99;
    if (reason.includes("⚡")) return 1;
    if (reason.includes("❌")) return 2;
    if (reason.includes("⛏️")) return 3;
    if (reason.includes("⏳")) return 4;
    if (reason.includes("🔧")) return 5;
    return 10;
  };

  jobs.sort((a, b) => REASON_PRIORITY(a.reason) - REASON_PRIORITY(b.reason));

  const keepStock = getKeepStockRows(state);
  const deconstructRequests = getDeconstructRequestQueueRows(state);
  const snapshot = { jobs, keepStock, deconstructRequests };

  lastProductionTransparencyInputs = nextInputs;
  lastProductionTransparencySnapshot = snapshot;

  return snapshot;
}
