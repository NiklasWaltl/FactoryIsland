import { computeConnectedAssetIds } from "../../logistics/connectivity";
import { createInitialState } from "../../store/initial-state";
import { POWER_POLE_RANGE } from "../../store/constants/energy/power-pole";
import type {
  AssetType,
  BuildingType,
  GameState,
  PlacedAsset,
} from "../../store/types";

interface GridAssetInput {
  id: string;
  type: AssetType;
  x: number;
  y: number;
  size?: 1 | 2;
  width?: 1 | 2;
  height?: 1 | 2;
  status?: PlacedAsset["status"] | "construction_site";
  constructionSite?: boolean;
}

function buildGridState(assetsToPlace: GridAssetInput[]): GameState {
  const baseState = createInitialState("release");
  const assets: Record<string, PlacedAsset> = {};
  const cellMap: Record<string, string> = {};
  const constructionSites: GameState["constructionSites"] = {};

  for (const input of assetsToPlace) {
    const size: 1 | 2 = input.size ?? 1;
    const width = input.width ?? size;
    const height = input.height ?? size;
    const status =
      input.status === "construction_site" ? undefined : input.status;

    const asset: PlacedAsset = {
      id: input.id,
      type: input.type,
      x: input.x,
      y: input.y,
      size,
      width: input.width,
      height: input.height,
      status,
    };

    assets[asset.id] = asset;

    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        cellMap[`${asset.x + dx},${asset.y + dy}`] = asset.id;
      }
    }

    if (input.constructionSite || input.status === "construction_site") {
      constructionSites[asset.id] = {
        buildingType: asset.type as BuildingType,
        remaining: { wood: 1 },
      };
    }
  }

  return {
    ...baseState,
    assets,
    cellMap,
    constructionSites,
  };
}

describe("computeConnectedAssetIds", () => {
  it("verbindet Generator -> Kabel -> Power-Pole nur fuer Maschinen in Pole-Range, nicht durch reine Kabel-Adjazenz", () => {
    const state = buildGridState([
      { id: "gen", type: "generator", x: 0, y: 0 },
      { id: "c1", type: "cable", x: 1, y: 0 },
      { id: "c2", type: "cable", x: 2, y: 0 },
      { id: "c3", type: "cable", x: 3, y: 0 },
      { id: "c4", type: "cable", x: 4, y: 0 },
      { id: "c5", type: "cable", x: 5, y: 0 },
      { id: "pole", type: "power_pole", x: 1, y: 1 },
      {
        id: "miner-in-range",
        type: "auto_miner",
        x: 1 + POWER_POLE_RANGE,
        y: 1,
      },
      {
        id: "miner-adjacent-cable-out-range",
        type: "auto_miner",
        x: 5,
        y: 1,
      },
    ]);

    const connected = new Set(computeConnectedAssetIds(state));

    expect(connected.has("miner-in-range")).toBe(true);
    expect(connected.has("miner-adjacent-cable-out-range")).toBe(false);
  });

  it("behandelt Maschine ausserhalb der Pole-Range als nicht verbunden, auch bei Kabel daneben", () => {
    const state = buildGridState([
      { id: "gen", type: "generator", x: 0, y: 0 },
      { id: "c1", type: "cable", x: 1, y: 0 },
      { id: "c2", type: "cable", x: 2, y: 0 },
      { id: "c3", type: "cable", x: 3, y: 0 },
      { id: "c4", type: "cable", x: 4, y: 0 },
      { id: "c5", type: "cable", x: 5, y: 0 },
      { id: "c6", type: "cable", x: 6, y: 0 },
      { id: "pole", type: "power_pole", x: 1, y: 1 },
      { id: "miner-out-range", type: "auto_miner", x: 6, y: 1 },
    ]);

    const connected = new Set(computeConnectedAssetIds(state));

    expect(connected.has("miner-out-range")).toBe(false);
  });

  it("erkennt 2x1-Asset ueber width/height, wenn mindestens eine Zelle in Pole-Range liegt", () => {
    const state = buildGridState([
      { id: "gen", type: "generator", x: 5, y: 3 },
      { id: "cable", type: "cable", x: 5, y: 4 },
      { id: "pole", type: "power_pole", x: 5, y: 5 },
      {
        id: "smelter-2x1",
        type: "auto_smelter",
        x: 5 + POWER_POLE_RANGE,
        y: 5,
        size: 2,
        width: 2,
        height: 1,
      },
    ]);

    const connected = new Set(computeConnectedAssetIds(state));

    expect(connected.has("smelter-2x1")).toBe(true);
  });

  it("nimmt 2x2-Warehouse nicht als Stromverbraucher auf", () => {
    const state = buildGridState([
      { id: "gen", type: "generator", x: 5, y: 3 },
      { id: "cable", type: "cable", x: 5, y: 4 },
      { id: "pole", type: "power_pole", x: 5, y: 5 },
      {
        id: "warehouse-2x2",
        type: "warehouse",
        x: 6,
        y: 5,
        size: 2,
      },
      {
        id: "miner-in-range",
        type: "auto_miner",
        x: 5 + POWER_POLE_RANGE,
        y: 5,
      },
    ]);

    const connected = new Set(computeConnectedAssetIds(state));

    expect(connected.has("miner-in-range")).toBe(true);
    expect(connected.has("warehouse-2x2")).toBe(false);
  });

  it("schliesst deconstructing-Assets aus, auch wenn sie in Pole-Range liegen", () => {
    const state = buildGridState([
      { id: "gen", type: "generator", x: 0, y: 0 },
      { id: "cable", type: "cable", x: 1, y: 0 },
      { id: "pole", type: "power_pole", x: 2, y: 0 },
      {
        id: "miner-deconstructing",
        type: "auto_miner",
        x: 2 + POWER_POLE_RANGE,
        y: 0,
        status: "deconstructing",
      },
    ]);

    const connected = new Set(computeConnectedAssetIds(state));

    expect(connected.has("miner-deconstructing")).toBe(false);
  });

  it("schliesst construction_site-Assets aus, auch wenn sie in Pole-Range liegen", () => {
    const state = buildGridState([
      { id: "gen", type: "generator", x: 0, y: 0 },
      { id: "cable", type: "cable", x: 1, y: 0 },
      { id: "pole", type: "power_pole", x: 2, y: 0 },
      {
        id: "miner-construction-site",
        type: "auto_miner",
        x: 2 + POWER_POLE_RANGE,
        y: 0,
        status: "construction_site",
      },
    ]);

    const connected = new Set(computeConnectedAssetIds(state));

    expect(connected.has("miner-construction-site")).toBe(false);
  });

  it("wendet beide Ausschlussregeln gleichzeitig in Pole-Range an", () => {
    const state = buildGridState([
      { id: "gen", type: "generator", x: 0, y: 0 },
      { id: "cable", type: "cable", x: 1, y: 0 },
      { id: "pole", type: "power_pole", x: 2, y: 0 },
      {
        id: "miner-deconstructing",
        type: "auto_miner",
        x: 2 + POWER_POLE_RANGE,
        y: 0,
        status: "deconstructing",
      },
      {
        id: "miner-construction-site",
        type: "auto_miner",
        x: 2 + POWER_POLE_RANGE,
        y: 1,
        status: "construction_site",
      },
    ]);

    const connected = new Set(computeConnectedAssetIds(state));

    expect(connected.has("miner-deconstructing")).toBe(false);
    expect(connected.has("miner-construction-site")).toBe(false);
  });

  it("isoliert getrennte Netzwerke: Netz A mit Generator versorgt, Netz B ohne Generator nicht", () => {
    const state = buildGridState([
      { id: "gen-a", type: "generator", x: 0, y: 0 },
      { id: "cable-a", type: "cable", x: 1, y: 0 },
      { id: "pole-a", type: "power_pole", x: 2, y: 0 },
      { id: "miner-a", type: "auto_miner", x: 2 + POWER_POLE_RANGE, y: 0 },
      { id: "cable-b", type: "cable", x: 30, y: 10 },
      { id: "pole-b", type: "power_pole", x: 31, y: 10 },
      {
        id: "miner-b",
        type: "auto_miner",
        x: 31 + POWER_POLE_RANGE,
        y: 10,
      },
    ]);

    const connected = new Set(computeConnectedAssetIds(state));

    expect(connected.has("miner-a")).toBe(true);
    expect(connected.has("miner-b")).toBe(false);
  });
});
