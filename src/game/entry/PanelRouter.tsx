import React, { useMemo } from "react";
import type { GameState } from "../store/types";
import type { GameAction } from "../store/game-actions";
import type { MapShopStateSlice } from "../store/types/ui-slice-types";
import { MapShopPanel } from "../ui/panels/MapShopPanel";
import { WarehousePanel } from "../ui/panels/WarehousePanel";
import { SmithyPanel } from "../ui/panels/SmithyPanel";
import { GeneratorPanel } from "../ui/panels/GeneratorPanel";
import { BatteryPanel } from "../ui/panels/BatteryPanel";
import { PowerPolePanel } from "../ui/panels/PowerPolePanel";
import { WorkbenchPanel } from "../ui/panels/WorkbenchPanel";
import { AutoMinerPanel } from "../ui/panels/AutoMinerPanel";
import { AutoSmelterPanel } from "../ui/panels/AutoSmelterPanel";
import { AutoAssemblerPanel } from "../ui/panels/AutoAssemblerPanel";
import { ManualAssemblerPanel } from "../ui/panels/ManualAssemblerPanel";
import { ServiceHubPanel } from "../ui/panels/ServiceHubPanel";
import { ConveyorSplitterPanel } from "../ui/panels/ConveyorSplitterPanel";
import { DockWarehousePanel } from "../ui/panels/DockWarehousePanel";
import { FragmentTraderPanel } from "../ui/panels/FragmentTraderPanel";
import { ModulLabPanel } from "../ui/panels/ModulLabPanel";
import { ResearchLabPanel } from "../ui/panels/ResearchLabPanel";

interface PanelRouterProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export const PanelRouter: React.FC<PanelRouterProps> = ({
  state,
  dispatch,
}) => {
  const mapShopSlice = useMemo<MapShopStateSlice>(
    () => ({
      coins: state.inventory.coins,
      unlockedBuildings: state.unlockedBuildings,
    }),
    [state.inventory.coins, state.unlockedBuildings],
  );

  return (
    <>
      {state.openPanel === "map_shop" && (
        <MapShopPanel state={mapShopSlice} dispatch={dispatch} />
      )}
      {state.openPanel === "warehouse" && (
        <WarehousePanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "smithy" && (
        <SmithyPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "generator" && (
        <GeneratorPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "battery" && (
        <BatteryPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "power_pole" && (
        <PowerPolePanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "workbench" && (
        <WorkbenchPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "auto_miner" && (
        <AutoMinerPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "auto_smelter" && (
        <AutoSmelterPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "auto_assembler" && (
        <AutoAssemblerPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "manual_assembler" && (
        <ManualAssemblerPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "service_hub" && (
        <ServiceHubPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "conveyor_splitter" && (
        <ConveyorSplitterPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "dock_warehouse" && (
        <DockWarehousePanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "fragment_trader" && (
        <FragmentTraderPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "module_lab" && (
        <ModulLabPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "research_lab" && (
        <ResearchLabPanel
          state={{
            inventory: state.inventory,
            unlockedBuildings: state.unlockedBuildings,
          }}
          dispatch={dispatch}
        />
      )}
    </>
  );
};
