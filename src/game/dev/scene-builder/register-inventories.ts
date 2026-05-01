import type { SceneDefinition, SceneItemStack } from "../scene-types";
import { createEmptyHubInventory } from "../../buildings/service-hub/hub-upgrade-workflow";
import { createDefaultProtoHubTargetStock } from "../../store/constants/hub/hub-target-stock";
import { createEmptyInventory } from "../../store/inventory-ops";
import type {
  CollectableItemType,
  GameState,
  Inventory,
  ServiceHubInventory,
} from "../../store/types";

const COLLECTABLE_ITEMS = new Set<CollectableItemType>([
  "wood",
  "stone",
  "iron",
  "copper",
]);

export const registerSceneInventories = (
  state: GameState,
  scene: SceneDefinition,
): GameState => {
  const inventory: Inventory = scene.resetGlobalInventory
    ? createEmptyInventory()
    : { ...state.inventory };
  if (scene.globalInventory) {
    for (const [key, value] of Object.entries(scene.globalInventory)) {
      if (typeof value === "number") {
        inventory[key as keyof Inventory] = value;
      }
    }
  }

  const warehouseInventories = { ...state.warehouseInventories };
  const serviceHubs = { ...state.serviceHubs };

  for (const definition of scene.assets) {
    if (definition.type === "warehouse") {
      warehouseInventories[definition.id] = stacksToInventory(
        definition.inventory ?? [],
      );
      continue;
    }

    if (definition.type === "service_hub") {
      serviceHubs[definition.id] = {
        tier: definition.hubTier ?? 1,
        inventory: stacksToHubInventory(definition.inventory ?? []),
        droneIds: [...(definition.droneIds ?? [])],
        targetStock: definition.targetStock ?? createDefaultProtoHubTargetStock(),
      };
    }
  }

  return { ...state, inventory, warehouseInventories, serviceHubs };
};

const stacksToInventory = (stacks: readonly SceneItemStack[]): Inventory => {
  const inventory = createEmptyInventory();
  for (const stack of stacks) {
    inventory[stack.itemId] = (inventory[stack.itemId] ?? 0) + stack.count;
  }
  return inventory;
};

const stacksToHubInventory = (
  stacks: readonly SceneItemStack[],
): ServiceHubInventory => {
  const inventory = createEmptyHubInventory();
  for (const stack of stacks) {
    if (COLLECTABLE_ITEMS.has(stack.itemId as CollectableItemType)) {
      inventory[stack.itemId as CollectableItemType] += stack.count;
    }
  }
  return inventory;
};