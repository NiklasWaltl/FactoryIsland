import type { SceneDefinition } from "../scene-types";
import { computeConnectedAssetIds } from "../../logistics/connectivity";
import { isEnergyConsumerType } from "../../store/helpers/machine-priority";
import type { GameState } from "../../store/types";

export const registerScenePower = (
  state: GameState,
  scene: SceneDefinition,
): GameState => {
  const generators = { ...state.generators };
  for (const definition of scene.assets) {
    if (definition.type !== "generator") continue;
    generators[definition.id] = {
      fuel: definition.fuel ?? 0,
      progress: 0,
      running: definition.running ?? false,
      requestedRefill: 0,
    };
  }

  const connectedAssetIds = computeConnectedAssetIds(state);
  const poweredMachineIds = connectedAssetIds.filter((id) => {
    const asset = state.assets[id];
    return asset ? isEnergyConsumerType(asset.type) : false;
  });
  const machinePowerRatio = Object.fromEntries(
    poweredMachineIds.map((id) => [id, 1]),
  );
  const firstPowerPole = scene.assets.find(
    (definition) => definition.type === "power_pole",
  );

  return {
    ...state,
    generators,
    connectedAssetIds,
    poweredMachineIds,
    machinePowerRatio,
    powerPolesPlaced: Object.values(state.assets).filter(
      (asset) => asset.type === "power_pole",
    ).length,
    selectedPowerPoleId: state.selectedPowerPoleId ?? firstPowerPole?.id ?? null,
  };
};