import { createInitialState } from "../initial-state";
import { getAutoSmelterIoCells } from "../asset-geometry";
import { gameReducer, type GameAction } from "../reducer";
import { buildSceneState } from "../../dev/scene-builder/build-scene-state";
import { debugSceneLayout } from "../../dev/scenes/debug-scene.layout";
import {
  canAssetReceiveFromConveyorSplitterOutput,
  getConveyorSplitterBackCell,
  getConveyorSplitterOutputCell,
  isValidConveyorSplitterInput,
} from "../conveyor/conveyor-geometry";
import { cellKey } from "../utils/cell-key";
import { directionOffset } from "../utils/direction";
import { isValidWarehouseInput } from "../warehouse-input";

describe("Debug-Scene Extended (Corner/Splitter/Underground/Assembler)", () => {
  const state = buildSceneState(debugSceneLayout, createInitialState("debug"));

  it("contains the extended debug-scene asset types", () => {
    const types = Object.values(state.assets).map((asset) => asset.type);

    expect(types).toContain("conveyor_corner");
    expect(types).toContain("conveyor_splitter");
    expect(types).toContain("conveyor_underground_in");
    expect(types).toContain("conveyor_underground_out");
    expect(types).toContain("auto_assembler");
  });

  it("wires the underground peer map bidirectionally", () => {
    const peerEntries = Object.entries(state.conveyorUndergroundPeers);

    expect(peerEntries).toHaveLength(2);
    const entryId = peerEntries.find(
      ([id]) => state.assets[id]?.type === "conveyor_underground_in",
    )?.[0];
    expect(entryId).toBeDefined();

    const exitId = state.conveyorUndergroundPeers[entryId!];
    expect(state.conveyorUndergroundPeers[exitId]).toBe(entryId);
    expect(state.assets[entryId!]?.type).toBe("conveyor_underground_in");
    expect(state.assets[exitId]?.type).toBe("conveyor_underground_out");
  });

  it("initializes the auto-assembler for the metal plate recipe", () => {
    const assemblers = Object.values(state.autoAssemblers);

    expect(assemblers).toHaveLength(1);
    expect(assemblers[0].selectedRecipe).toBe("metal_plate");
    expect(assemblers[0].status).toBe("IDLE");
    expect(assemblers[0].ironIngotBuffer).toBe(0);
    expect(assemblers[0].pendingOutput).toEqual([]);
  });

  it("connects the splitter back input and both side outputs", () => {
    const splitter = Object.values(state.assets).find(
      (asset) => asset.type === "conveyor_splitter",
    );
    expect(splitter).toBeDefined();

    const back = getConveyorSplitterBackCell(splitter!);
    const backId = state.cellMap[cellKey(back.x, back.y)];
    const backAsset = state.assets[backId];
    expect(backAsset).toBeDefined();
    expect(isValidConveyorSplitterInput(backAsset!, splitter!)).toBe(true);

    for (const side of ["left", "right"] as const) {
      const outputCell = getConveyorSplitterOutputCell(splitter!, side);
      const outputId = state.cellMap[cellKey(outputCell.x, outputCell.y)];
      const outputAsset = state.assets[outputId];
      expect(outputAsset).toBeDefined();
      expect(
        canAssetReceiveFromConveyorSplitterOutput(splitter!, outputAsset!),
      ).toBe(true);
    }
  });

  it("connects the auto-assembler input and output belts", () => {
    const assemblerAsset = Object.values(state.assets).find(
      (asset) => asset.type === "auto_assembler",
    );
    expect(assemblerAsset).toBeDefined();

    expect(state.cellMap[cellKey(assemblerAsset!.x, assemblerAsset!.y)]).toBe(
      assemblerAsset!.id,
    );

    const io = getAutoSmelterIoCells(assemblerAsset!);
    const inputId = state.cellMap[cellKey(io.input.x, io.input.y)];
    const outputId = state.cellMap[cellKey(io.output.x, io.output.y)];

    expect(state.assets[inputId]?.type).toBe("conveyor_underground_out");
    expect(state.assets[outputId]?.type).toBe("conveyor");
  });

  it("routes assembler output belt into a second warehouse", () => {
    const warehouses = Object.values(state.assets).filter(
      (asset) => asset.type === "warehouse",
    );
    expect(warehouses.length).toBeGreaterThanOrEqual(2);

    const assemblerAsset = Object.values(state.assets).find(
      (asset) => asset.type === "auto_assembler",
    );
    expect(assemblerAsset).toBeDefined();

    const io = getAutoSmelterIoCells(assemblerAsset!);
    const outputBeltId = state.cellMap[cellKey(io.output.x, io.output.y)];
    const outputBelt = state.assets[outputBeltId];
    expect(outputBelt?.type).toBe("conveyor");

    const [dx, dy] = directionOffset(outputBelt!.direction ?? "east");
    const nextId =
      state.cellMap[cellKey(outputBelt!.x + dx, outputBelt!.y + dy)];
    const outputWarehouse = state.assets[nextId];
    expect(outputWarehouse?.type).toBe("warehouse");
    expect(
      isValidWarehouseInput(
        outputBelt!.x,
        outputBelt!.y,
        outputBelt!.direction ?? "east",
        outputWarehouse!,
      ),
    ).toBe(true);
    expect(state.warehouseInventories[outputWarehouse!.id]).toBeDefined();
  });

  it("moves assembler output items into the new warehouse during LOGISTICS_TICK", () => {
    const tickState = buildSceneState(
      debugSceneLayout,
      createInitialState("debug"),
    );
    const assemblerAsset = Object.values(tickState.assets).find(
      (asset) => asset.type === "auto_assembler",
    );
    expect(assemblerAsset).toBeDefined();

    const io = getAutoSmelterIoCells(assemblerAsset!);
    const outputBeltId = tickState.cellMap[cellKey(io.output.x, io.output.y)];
    const outputBelt = tickState.assets[outputBeltId];
    expect(outputBelt?.type).toBe("conveyor");

    const [dx, dy] = directionOffset(outputBelt!.direction ?? "east");
    const warehouseId = tickState.cellMap[
      cellKey(outputBelt!.x + dx, outputBelt!.y + dy)
    ];
    const outputWarehouse = tickState.assets[warehouseId];
    expect(outputWarehouse?.type).toBe("warehouse");

    tickState.conveyors[outputBeltId] = { queue: ["metalPlate"] };
    const before = tickState.warehouseInventories[warehouseId]?.metalPlate ?? 0;

    const after = gameReducer(tickState, {
      type: "LOGISTICS_TICK",
    } as GameAction);

    expect(after.conveyors[outputBeltId].queue).toEqual([]);
    expect(after.warehouseInventories[warehouseId].metalPlate).toBe(before + 1);
  });

  it("powers all new extended-scene consumers", () => {
    const newConsumerTypes = [
      "conveyor_corner",
      "conveyor_splitter",
      "conveyor_underground_in",
      "conveyor_underground_out",
      "auto_assembler",
    ];
    const newConsumerIds = Object.values(state.assets)
      .filter((asset) => newConsumerTypes.includes(asset.type))
      .map((asset) => asset.id);

    for (const id of newConsumerIds) {
      expect(state.connectedAssetIds).toContain(id);
      expect(state.poweredMachineIds).toContain(id);
    }
  });
});
