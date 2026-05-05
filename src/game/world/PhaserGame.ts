import Phaser from "phaser";
import {
  ASSET_SPRITES,
  STONE_FLOOR_BASE,
  STONE_FLOOR_BLOCKS,
  STONE_FLOOR_MORTAR,
  STONE_FLOOR_MORTAR_COLOR,
} from "../assets/sprites/sprites";
import { CELL_PX, GRID_H, GRID_W } from "../constants/grid";
import { WATER_START_ROW } from "../store/constants/map/map-layout";
import { ASSET_LABELS } from "../store/constants/ui/assets";
import type { Direction } from "../store/types";
import { getInitialCameraFocusPoint } from "./camera-focus";
import { TileRenderer } from "./tile-renderer";
import type { TileType } from "./tile-types";

const GAME_W = GRID_W * CELL_PX;
const GAME_H = GRID_H * CELL_PX;

/** Event name used to push floorMap updates from React into the Phaser scene. */
export const FLOOR_MAP_EVENT = "floorMapChanged";

/** Event name used to push terrain tile snapshots from React into the Phaser scene. */
export const TILE_MAP_EVENT = "tileMapChanged";

/** Event name used to push static asset snapshots from React into the Phaser scene. */
export const STATIC_ASSETS_EVENT = "staticAssetsChanged";

/** Event name used to push collection node snapshots from React into the Phaser scene. */
export const COLLECTION_NODES_EVENT = "collectionNodesChanged";

/** Event name used to push drone state from React into the Phaser scene. */
export const DRONE_STATE_EVENT = "droneStateChanged";

/** Event name used to push ship state from React into the Phaser scene. */
export const SHIP_STATE_EVENT = "shipStateChanged";

export const COIN_AWARD_EVENT = "coin_award_event";

export interface CoinAwardPayload {
  amount: number;
  fromTileX: number;
  fromTileY: number;
}

/** The floorMap shape coming from React state. */
export type FloorMapData = Record<string, string>;

/** The terrain tileMap shape coming from React state. */
export type TileMapData = TileType[][];

export interface StaticAssetSnapshot {
  id: string;
  type:
    | "map_shop"
    | "stone_deposit"
    | "iron_deposit"
    | "copper_deposit"
    | "stone"
    | "iron"
    | "copper"
    | "tree"
    | "sapling"
    | "cable"
    | "generator"
    | "battery"
    | "power_pole"
    | "conveyor"
    | "conveyor_corner"
    | "conveyor_merger"
    | "conveyor_splitter"
    | "conveyor_underground_in"
    | "conveyor_underground_out"
    | "auto_miner"
    | "auto_smelter"
    | "auto_assembler"
    | "warehouse"
    | "workbench"
    | "smithy"
    | "manual_assembler"
    | "service_hub"
    | "dock_warehouse"
    | "module_lab";
  x: number;
  y: number;
  width: 1 | 2;
  height: 1 | 2;
  direction?: Direction;
  isUnderConstruction?: boolean;
  isDeconstructing?: boolean;
}

export interface CollectionNodeSnapshot {
  id: string;
  itemType: "wood" | "stone" | "iron" | "copper";
  amount: number;
  tileX: number;
  tileY: number;
}

export interface DroneSnapshot {
  droneId: string;
  status: string;
  tileX: number;
  tileY: number;
  cargo: { itemType: string; amount: number } | null;
  hubId: string | null;
  isParkedAtHub: boolean;
  parkingSlot: number | null;
}

export interface ShipSnapshot {
  status: "sailing" | "docked" | "departing";
  dockTileX: number;
  dockTileY: number;
  inputTileX: number;
  inputTileY: number;
}

const COLLECTION_NODE_COLORS: Record<string, number> = {
  wood: 0x8b4513,
  stone: 0x808080,
  iron: 0x708090,
  copper: 0xb87333,
};

const COLLECTION_NODE_LABELS: Record<string, string> = {
  wood: "Holz",
  stone: "Stein",
  iron: "Eisen",
  copper: "Kupfer",
};

const DRONE_STATUS_LABELS: Record<string, string> = {
  idle: "Drohne: bereit",
  moving_to_collect: "Drohne: ->Node",
  collecting: "Drohne: sammle",
  moving_to_dropoff: "Drohne: ->Ziel",
  depositing: "Drohne: abladen",
  returning_to_dock: "Drohne: ->Hub",
};

const DIRECTION_ROTATION: Record<Direction, number> = {
  north: 270,
  east: 0,
  south: 90,
  west: 180,
};

const DECONSTRUCT_OVERLAY_STROKE_COLOR = 0xff6a00;
const DECONSTRUCT_OVERLAY_STROKE_ALPHA = 0.95;
const DECONSTRUCT_OVERLAY_FILL_COLOR = 0xff8a00;
const DECONSTRUCT_OVERLAY_FILL_ALPHA = 0.14;
const DECONSTRUCT_OVERLAY_PULSE_ALPHA = 0.42;
const DECONSTRUCT_OVERLAY_PULSE_DURATION_MS = 520;
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

const COIN_AWARD_MIN_PARTICLES = 8;
const COIN_AWARD_MAX_PARTICLES = 12;
const COIN_AWARD_AMOUNT_PER_EXTRA_PARTICLE = 50;
const COIN_AWARD_PARTICLE_RADIUS_PX = 4;
const COIN_AWARD_PARTICLE_COLOR = 0xffd700;
const COIN_AWARD_START_SPREAD_PX = 20;
const COIN_AWARD_DURATION_MS = 600;
const COIN_AWARD_DELAY_STEP_MS = 40;
const COIN_AWARD_DEPTH = 1_000;
const HUD_COIN_X = 28;
const HUD_COIN_Y = 26;
const HUD_COIN_BUMP_RADIUS_PX = 8;
const HUD_COIN_BUMP_SCALE = 1.3;
const HUD_COIN_BUMP_DURATION_MS = 200;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches
  );
}

/** World scene - renders terrain tiles, stone floor, assets, drops, and drones. */
class WorldScene extends Phaser.Scene {
  /** Terrain graphics layer rendered below all other world objects. */
  private tileRenderer: TileRenderer | null = null;
  /** Last rendered terrain snapshot; reference compare is enough for reducer snapshots. */
  private lastTileMap: TileMapData | null = null;
  /** Stone floor tilemap layer � tiles set/cleared via applyFloorMap(). */
  private floorLayer!: Phaser.Tilemaps.TilemapLayer;
  /** The firstgid assigned to the stone floor tileset in the shared tilemap. */
  private floorFirstGid = 0;
  /** Static world assets currently rendered by Phaser. */
  private staticAssetNodes = new Map<string, Phaser.GameObjects.Container>();
  /** Running deconstruct overlay pulse tweens keyed by asset id. */
  private deconstructOverlayTweens = new Map<string, Phaser.Tweens.Tween>();
  /** Collection node drop markers (manual harvests). */
  private collectionNodeContainers = new Map<
    string,
    Phaser.GameObjects.Container
  >();
  /** The single starter drone marker. */
  private droneContainers = new Map<string, Phaser.GameObjects.Container>();
  /** Last logged hub parking signature to avoid per-update spam in DEV. */
  private lastParkingDebugSignature = "";
  /** Previous parked/not-parked state per drone for transition logs. */
  private lastDroneParkingState = new Map<
    string,
    { hubId: string | null; parked: boolean; status: string }
  >();
  /** Initial camera focus is derived once from the reducer-owned tileMap. */
  private hasAppliedInitialCameraFocus = false;
  /** Ship Phaser container: rectangle + anchor label. */
  private shipContainer: Phaser.GameObjects.Container | null = null;
  /** Dock warehouse conveyor input marker, visible while the ship waits for cargo. */
  private dockInputMarkerContainer: Phaser.GameObjects.Container | null = null;
  private dockInputMarkerTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super({ key: "WorldScene" });
  }

  preload(): void {
    this.load.image("asset:map_shop", ASSET_SPRITES.map_shop);
    this.load.image("asset:stone_deposit", ASSET_SPRITES.stone_deposit);
    this.load.image("asset:iron_deposit", ASSET_SPRITES.iron_deposit);
    this.load.image("asset:copper_deposit", ASSET_SPRITES.copper_deposit);
    this.load.image("asset:stone", ASSET_SPRITES.stone);
    this.load.image("asset:iron", ASSET_SPRITES.iron);
    this.load.image("asset:copper", ASSET_SPRITES.copper);
    this.load.image("asset:tree", ASSET_SPRITES.tree);
    this.load.image("asset:sapling", ASSET_SPRITES.sapling);
    this.load.image("asset:cable", ASSET_SPRITES.cable);
    this.load.image("asset:generator", ASSET_SPRITES.generator);
    this.load.image("asset:battery", ASSET_SPRITES.battery);
    this.load.image("asset:power_pole", ASSET_SPRITES.power_pole);
    this.load.image("asset:conveyor", ASSET_SPRITES.conveyor);
    this.load.image("asset:conveyor_corner", ASSET_SPRITES.conveyor_corner);
    this.load.image("asset:conveyor_merger", ASSET_SPRITES.conveyor_merger);
    this.load.image("asset:conveyor_splitter", ASSET_SPRITES.conveyor_splitter);
    this.load.image(
      "asset:conveyor_underground_in",
      ASSET_SPRITES.conveyor_underground_in,
    );
    this.load.image(
      "asset:conveyor_underground_out",
      ASSET_SPRITES.conveyor_underground_out,
    );
    this.load.image("asset:auto_miner", ASSET_SPRITES.auto_miner);
    this.load.image("asset:auto_smelter", ASSET_SPRITES.auto_smelter);
    this.load.image("asset:auto_assembler", ASSET_SPRITES.auto_assembler);
    this.load.image("asset:warehouse", ASSET_SPRITES.warehouse);
    this.load.image("asset:workbench", ASSET_SPRITES.workbench);
    this.load.image("asset:smithy", ASSET_SPRITES.smithy);
    this.load.image("asset:manual_assembler", ASSET_SPRITES.manual_assembler);
    this.load.image("asset:service_hub", ASSET_SPRITES.service_hub);
    this.load.image("asset:dock_warehouse", ASSET_SPRITES.dock_warehouse);
    this.load.image("asset:module_lab", ASSET_SPRITES.module_lab);
  }

  create(): void {
    this.buildLayers();
    this.tileRenderer = new TileRenderer(this, CELL_PX);
    this.setWorldBounds(GRID_W, GRID_H);

    this.events.once("shutdown", () => {
      this.destroyTileRenderer();
      this.stopAllDeconstructOverlayPulses();
    });
    this.events.once("destroy", () => {
      this.destroyTileRenderer();
      this.stopAllDeconstructOverlayPulses();
    });

    this.events.on(TILE_MAP_EVENT, (data: TileMapData) => {
      this.applyTileMap(data);
    });

    // Listen for floorMap updates from React
    this.events.on(FLOOR_MAP_EVENT, (data: FloorMapData) => {
      this.applyFloorMap(data);
    });

    this.events.on(STATIC_ASSETS_EVENT, (data: StaticAssetSnapshot[]) => {
      this.applyStaticAssets(data);
    });

    this.events.on(COLLECTION_NODES_EVENT, (data: CollectionNodeSnapshot[]) => {
      this.applyCollectionNodes(data);
    });

    this.events.on(DRONE_STATE_EVENT, (data: DroneSnapshot[]) => {
      this.applyDroneStates(data);
    });

    this.events.on(SHIP_STATE_EVENT, (data: ShipSnapshot) => {
      this.applyShipState(data);
    });

    this.events.on(COIN_AWARD_EVENT, (payload: CoinAwardPayload) => {
      this.playCoinAwardAnimation(payload);
    });

    this.shipContainer = this.createShipContainer();
    this.dockInputMarkerContainer = this.createDockInputMarkerContainer();
  }

  private applyTileMap(data: TileMapData): void {
    if (data === this.lastTileMap) return;
    this.lastTileMap = data;
    this.setWorldBounds(data[0]?.length ?? 0, data.length);
    this.applyInitialCameraFocus(data);
    this.tileRenderer?.render(data);
  }

  private setWorldBounds(cols: number, rows: number): void {
    this.cameras.main.setBounds(0, 0, cols * CELL_PX, rows * CELL_PX);
  }

  private applyInitialCameraFocus(data: TileMapData): void {
    if (this.hasAppliedInitialCameraFocus) return;
    const focus = getInitialCameraFocusPoint(data);
    this.cameras.main.centerOn(focus.x, focus.y);
    this.hasAppliedInitialCameraFocus = true;
  }

  private destroyTileRenderer(): void {
    this.tileRenderer?.destroy();
    this.tileRenderer = null;
    this.lastTileMap = null;
    this.hasAppliedInitialCameraFocus = false;
  }

  /** Apply a full floorMap snapshot � set or clear tiles as needed. */
  private applyFloorMap(data: FloorMapData): void {
    // Clear all existing floor tiles
    this.floorLayer.forEachTile((t: Phaser.Tilemaps.Tile) => {
      if (t.index !== -1) {
        this.floorLayer.removeTileAt(t.x, t.y);
      }
    });

    // Place floor tiles from snapshot
    for (const key of Object.keys(data)) {
      const [gx, gy] = key.split(",").map(Number);
      if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
        this.floorLayer.putTileAt(this.floorFirstGid, gx, gy);
      }
    }

    if (import.meta.env.DEV) {
      let placed = 0;
      this.floorLayer.forEachTile((t: Phaser.Tilemaps.Tile) => {
        if (t.index !== -1) placed++;
      });
      console.debug("[WorldScene] floorMapChanged", {
        entries: Object.keys(data).length,
        placed,
      });
    }
  }

  /** Apply a full static-asset snapshot for Phaser-rendered world sprites. */
  private applyStaticAssets(data: StaticAssetSnapshot[]): void {
    const nextIds = new Set<string>();

    for (const asset of data) {
      nextIds.add(asset.id);

      let container = this.staticAssetNodes.get(asset.id);
      if (!container) {
        container = this.createStaticAssetContainer(asset);
        this.staticAssetNodes.set(asset.id, container);
      }

      this.updateStaticAssetContainer(container, asset);
    }

    for (const [id, container] of this.staticAssetNodes.entries()) {
      if (nextIds.has(id)) continue;
      this.stopDeconstructOverlayPulse(id);
      container.destroy(true);
      this.staticAssetNodes.delete(id);
    }
  }

  /** Create a Phaser container for one static world asset. */
  private createStaticAssetContainer(
    asset: StaticAssetSnapshot,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const image = this.add
      .image(0, 0, `asset:${asset.type}`)
      .setOrigin(0.5, 0.5);
    const statusOverlay = this.add.graphics();
    const label = this.add.text(0, 0, ASSET_LABELS[asset.type], {
      fontFamily: "Arial",
      fontSize: "9px",
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    });

    image.name = "sprite";
    statusOverlay.name = "status-overlay";
    label.name = "label";

    container.add([image, statusOverlay, label]);
    container.setDepth(2);
    return container;
  }

  /** Keep a static world asset container aligned with the shared world grid. */
  private updateStaticAssetContainer(
    container: Phaser.GameObjects.Container,
    asset: StaticAssetSnapshot,
  ): void {
    const worldWidth = asset.width * CELL_PX;
    const worldHeight = asset.height * CELL_PX;
    const image = container.getByName("sprite") as Phaser.GameObjects.Image;
    const statusOverlay = container.getByName(
      "status-overlay",
    ) as Phaser.GameObjects.Graphics;
    const label = container.getByName("label") as Phaser.GameObjects.Text;

    container.setPosition(asset.x * CELL_PX, asset.y * CELL_PX);

    image.setPosition(worldWidth / 2, (worldHeight - 16) / 2);
    image.setDisplaySize(worldWidth - 4, worldHeight - 16);
    if (
      asset.type === "conveyor" ||
      asset.type === "conveyor_corner" ||
      asset.type === "conveyor_merger" ||
      asset.type === "conveyor_splitter" ||
      asset.type === "conveyor_underground_in" ||
      asset.type === "conveyor_underground_out" ||
      asset.type === "auto_miner" ||
      asset.type === "auto_smelter" ||
      asset.type === "auto_assembler"
    ) {
      image.setAngle(DIRECTION_ROTATION[asset.direction ?? "east"]);
    } else {
      image.setAngle(0);
    }

    label.setText(
      asset.isUnderConstruction
        ? `${ASSET_LABELS[asset.type]} 🔧`
        : ASSET_LABELS[asset.type],
    );
    label.setOrigin(0.5, 0);
    label.setPosition(worldWidth / 2, worldHeight - 15);

    // Construction site visual: reduced opacity
    image.setAlpha(asset.isUnderConstruction ? 0.45 : 1);

    statusOverlay.clear();
    if (asset.isDeconstructing) {
      const overlayX = 2;
      const overlayY = 2;
      const overlayWidth = Math.max(4, worldWidth - 4);
      const overlayHeight = Math.max(4, worldHeight - 20);
      statusOverlay.fillStyle(
        DECONSTRUCT_OVERLAY_FILL_COLOR,
        DECONSTRUCT_OVERLAY_FILL_ALPHA,
      );
      statusOverlay.fillRect(overlayX, overlayY, overlayWidth, overlayHeight);
      statusOverlay.lineStyle(
        2,
        DECONSTRUCT_OVERLAY_STROKE_COLOR,
        DECONSTRUCT_OVERLAY_STROKE_ALPHA,
      );
      statusOverlay.strokeRect(overlayX, overlayY, overlayWidth, overlayHeight);
      this.ensureDeconstructOverlayPulse(asset.id, statusOverlay);
    } else {
      this.stopDeconstructOverlayPulse(asset.id, statusOverlay);
    }
  }

  private ensureDeconstructOverlayPulse(
    assetId: string,
    statusOverlay: Phaser.GameObjects.Graphics,
  ): void {
    if (prefersReducedMotion()) {
      this.stopDeconstructOverlayPulse(assetId, statusOverlay);
      return;
    }

    if (this.deconstructOverlayTweens.has(assetId)) return;

    statusOverlay.setAlpha(1);
    const tween = this.tweens.add({
      targets: statusOverlay,
      alpha: DECONSTRUCT_OVERLAY_PULSE_ALPHA,
      duration: DECONSTRUCT_OVERLAY_PULSE_DURATION_MS,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.deconstructOverlayTweens.set(assetId, tween);
  }

  private stopDeconstructOverlayPulse(
    assetId: string,
    statusOverlay?: Phaser.GameObjects.Graphics,
  ): void {
    const tween = this.deconstructOverlayTweens.get(assetId);
    if (tween) {
      tween.stop();
      this.deconstructOverlayTweens.delete(assetId);
    }
    statusOverlay?.setAlpha(1);
  }

  private stopAllDeconstructOverlayPulses(): void {
    for (const tween of this.deconstructOverlayTweens.values()) {
      tween.stop();
    }
    this.deconstructOverlayTweens.clear();
  }

  private applyCollectionNodes(data: CollectionNodeSnapshot[]): void {
    const nextIds = new Set<string>();
    for (const node of data) {
      nextIds.add(node.id);
      if (!this.collectionNodeContainers.has(node.id)) {
        this.collectionNodeContainers.set(
          node.id,
          this.createCollectionNodeContainer(),
        );
      }
      this.updateCollectionNodeContainer(
        this.collectionNodeContainers.get(node.id)!,
        node,
      );
    }
    for (const [id, container] of this.collectionNodeContainers.entries()) {
      if (!nextIds.has(id)) {
        container.destroy(true);
        this.collectionNodeContainers.delete(id);
      }
    }
  }

  private createCollectionNodeContainer(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const gfx = this.add.graphics();
    gfx.name = "gfx";
    const label = this.add
      .text(0, 0, "", {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: { left: 3, right: 3, top: 1, bottom: 1 },
      })
      .setOrigin(0.5, 0);
    label.name = "label";
    container.add([gfx, label]);
    container.setDepth(10);
    return container;
  }

  private updateCollectionNodeContainer(
    container: Phaser.GameObjects.Container,
    node: CollectionNodeSnapshot,
  ): void {
    const cx = node.tileX * CELL_PX + CELL_PX / 2;
    const cy = node.tileY * CELL_PX + CELL_PX / 2;
    container.setPosition(cx, cy);
    const gfx = container.getByName("gfx") as Phaser.GameObjects.Graphics;
    const label = container.getByName("label") as Phaser.GameObjects.Text;
    const size = 32;
    const color = COLLECTION_NODE_COLORS[node.itemType] ?? 0xffff00;
    const name = COLLECTION_NODE_LABELS[node.itemType] ?? node.itemType;
    gfx.clear();
    gfx.fillStyle(color, 0.9);
    gfx.fillRect(-size / 2, -size / 2, size, size);
    gfx.lineStyle(2, 0xffffff, 0.8);
    gfx.strokeRect(-size / 2, -size / 2, size, size);
    label.setText(`${name} x${node.amount}`);
    label.setPosition(0, size / 2 + 2);
  }

  private applyDroneStates(data: DroneSnapshot[]): void {
    const activeIds = new Set<string>();
    for (const drone of data) {
      activeIds.add(drone.droneId);
      let container = this.droneContainers.get(drone.droneId);
      if (!container) {
        container = this.createDroneContainer();
        this.droneContainers.set(drone.droneId, container);
      }
      container.setVisible(true);
      this.updateDroneContainer(drone);
    }
    // Hide/remove containers for drones no longer present
    for (const [id, container] of this.droneContainers.entries()) {
      if (!activeIds.has(id)) {
        container.destroy(true);
        this.droneContainers.delete(id);
      }
    }

    this.debugParkingSync(data);
  }

  private createDroneContainer(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const gfx = this.add.graphics();
    gfx.name = "gfx";
    const label = this.add
      .text(0, 0, "", {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,50,0.85)",
        padding: { left: 3, right: 3, top: 1, bottom: 1 },
      })
      .setOrigin(0.5, 0);
    label.name = "label";
    container.add([gfx, label]);
    container.setDepth(15);
    return container;
  }

  private updateDroneContainer(data: DroneSnapshot): void {
    const container = this.droneContainers.get(data.droneId);
    if (!container) return;
    const cx = data.tileX * CELL_PX + CELL_PX / 2;
    const cy = data.tileY * CELL_PX + CELL_PX / 2;
    container.setPosition(cx, cy);
    const gfx = container.getByName("gfx") as Phaser.GameObjects.Graphics;
    const label = container.getByName("label") as Phaser.GameObjects.Text;
    const radius = data.isParkedAtHub ? 12 : 16;
    const alpha = data.isParkedAtHub ? 0.78 : 0.9;
    gfx.clear();
    gfx.fillStyle(0x00ccff, alpha);
    gfx.fillCircle(0, 0, radius);
    gfx.lineStyle(2, 0x0044aa, 1);
    gfx.strokeCircle(0, 0, radius);
    gfx.fillStyle(0x0044aa, 1);
    gfx.fillCircle(0, 0, 5);
    const cargoText = data.cargo
      ? ` (${data.cargo.amount}x ${data.cargo.itemType})`
      : "";
    const parkingText =
      data.isParkedAtHub && data.parkingSlot !== null
        ? ` [P${data.parkingSlot + 1}]`
        : "";
    label.setText(
      `${DRONE_STATUS_LABELS[data.status] ?? data.status}${parkingText}${cargoText}`,
    );
    label.setPosition(0, 18);
    container.setDepth(data.isParkedAtHub ? 14 : 15);
  }

  private debugParkingSync(data: DroneSnapshot[]): void {
    if (!import.meta.env.DEV) return;

    const hubStats = new Map<
      string,
      { total: number; parked: number; active: number }
    >();
    const nextDroneParkingState = new Map<
      string,
      { hubId: string | null; parked: boolean; status: string }
    >();

    for (const drone of data) {
      nextDroneParkingState.set(drone.droneId, {
        hubId: drone.hubId,
        parked: drone.isParkedAtHub,
        status: drone.status,
      });

      const previous = this.lastDroneParkingState.get(drone.droneId);
      if (
        !previous ||
        previous.parked !== drone.isParkedAtHub ||
        previous.status !== drone.status ||
        previous.hubId !== drone.hubId
      ) {
        if (previous?.parked && !drone.isParkedAtHub) {
          console.debug(
            `[Parking visuals] Drone ${drone.droneId} status=${drone.status} -> remove from parked visuals`,
          );
        }
        if ((!previous || !previous.parked) && drone.isParkedAtHub) {
          console.debug(
            `[Parking visuals] Drone ${drone.droneId} returned -> show in parked visuals`,
          );
        }
      }

      if (!drone.hubId) continue;
      const stats = hubStats.get(drone.hubId) ?? {
        total: 0,
        parked: 0,
        active: 0,
      };
      stats.total += 1;
      if (drone.isParkedAtHub) {
        stats.parked += 1;
      } else {
        stats.active += 1;
      }
      hubStats.set(drone.hubId, stats);
    }

    const nextSignature = [...hubStats.entries()]
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
      .map(
        ([hubId, stats]) =>
          `${hubId}:${stats.total}:${stats.parked}:${stats.active}`,
      )
      .join("|");

    if (nextSignature !== this.lastParkingDebugSignature) {
      for (const [hubId, stats] of hubStats.entries()) {
        console.debug(
          `[Hub ${hubId}] total drones=${stats.total}, parked=${stats.parked}, active=${stats.active}`,
        );
        console.debug(
          `[Parking visuals] hub=${hubId} visibleSlots=${stats.parked}, expected=${stats.parked}`,
        );
      }
      this.lastParkingDebugSignature = nextSignature;
    }

    this.lastDroneParkingState = nextDroneParkingState;
  }

  private createShipContainer(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const gfx = this.add.graphics();
    gfx.name = "gfx";
    gfx.fillStyle(0x2255aa, 1);
    gfx.fillRect(0, 0, CELL_PX * 2, CELL_PX);
    gfx.lineStyle(2, 0x88bbff, 1);
    gfx.strokeRect(0, 0, CELL_PX * 2, CELL_PX);
    const label = this.add
      .text(CELL_PX, CELL_PX + 2, "", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: { left: 4, right: 4, top: 1, bottom: 1 },
      })
      .setOrigin(0.5, 0);
    label.name = "label";
    container.add([gfx, label]);
    container.setDepth(20);
    container.setVisible(false);
    return container;
  }

  private applyShipState(data: ShipSnapshot): void {
    const container = this.shipContainer;
    if (!container) return;
    if (data.status === "docked") {
      container.setPosition(
        data.dockTileX * CELL_PX,
        WATER_START_ROW * CELL_PX,
      );
      container.setVisible(true);
      const label = container.getByName("label") as Phaser.GameObjects.Text;
      label.setText("⚓ Angedockt");
      this.showDockInputMarker(data.inputTileX, data.inputTileY);
    } else {
      container.setVisible(false);
      this.hideDockInputMarker();
    }
  }

  private createDockInputMarkerContainer(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const pulseLayer = this.add.container(0, 0);
    pulseLayer.name = "pulse";

    const gfx = this.add.graphics();
    gfx.lineStyle(2, 0x00ffcc, 0.85);
    gfx.fillStyle(0x00ffcc, 0.1);
    gfx.fillRoundedRect(3, 3, CELL_PX - 6, CELL_PX - 6, 5);
    gfx.strokeRoundedRect(3, 3, CELL_PX - 6, CELL_PX - 6, 5);
    gfx.lineStyle(2, 0xffffff, 0.55);
    gfx.beginPath();
    gfx.moveTo(CELL_PX / 2, 10);
    gfx.lineTo(CELL_PX / 2, CELL_PX - 14);
    gfx.moveTo(CELL_PX / 2 - 5, CELL_PX - 19);
    gfx.lineTo(CELL_PX / 2, CELL_PX - 13);
    gfx.lineTo(CELL_PX / 2 + 5, CELL_PX - 19);
    gfx.strokePath();
    pulseLayer.add(gfx);

    const label = this.add
      .text(CELL_PX / 2, -14, "Förderband hier", {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#dffcff",
        backgroundColor: "rgba(0,32,40,0.72)",
        padding: { left: 4, right: 4, top: 1, bottom: 1 },
      })
      .setOrigin(0.5, 1);
    label.name = "label";

    container.add([pulseLayer, label]);
    container.setDepth(21);
    container.setVisible(false);
    this.dockInputMarkerTween = this.tweens.add({
      targets: pulseLayer,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      paused: true,
    });
    return container;
  }

  private showDockInputMarker(tileX: number, tileY: number): void {
    const marker = this.dockInputMarkerContainer;
    if (!marker) return;
    marker.setPosition(tileX * CELL_PX, tileY * CELL_PX);
    marker.setVisible(true);
    this.dockInputMarkerTween?.resume();
  }

  private hideDockInputMarker(): void {
    const marker = this.dockInputMarkerContainer;
    if (!marker) return;
    marker.setVisible(false);
    this.dockInputMarkerTween?.pause();
  }

  private playCoinAwardAnimation(payload: CoinAwardPayload): void {
    const start = this.getScreenPointFromTile(payload.fromTileX, payload.fromTileY);
    const particleCount = Phaser.Math.Clamp(
      COIN_AWARD_MIN_PARTICLES +
        Math.floor(payload.amount / COIN_AWARD_AMOUNT_PER_EXTRA_PARTICLE),
      COIN_AWARD_MIN_PARTICLES,
      COIN_AWARD_MAX_PARTICLES,
    );

    for (let index = 0; index < particleCount; index += 1) {
      const coin = this.add
        .circle(
          start.x +
            Phaser.Math.Between(
              -COIN_AWARD_START_SPREAD_PX,
              COIN_AWARD_START_SPREAD_PX,
            ),
          start.y +
            Phaser.Math.Between(
              -COIN_AWARD_START_SPREAD_PX,
              COIN_AWARD_START_SPREAD_PX,
            ),
          COIN_AWARD_PARTICLE_RADIUS_PX,
          COIN_AWARD_PARTICLE_COLOR,
        )
        .setDepth(COIN_AWARD_DEPTH)
        .setScrollFactor(0);

      this.tweens.add({
        targets: coin,
        x: HUD_COIN_X,
        y: HUD_COIN_Y,
        alpha: 0,
        duration: COIN_AWARD_DURATION_MS,
        ease: "Cubic.easeIn",
        delay: index * COIN_AWARD_DELAY_STEP_MS,
        onComplete: () => coin.destroy(),
      });
    }

    this.playCoinHudBump();
  }

  private getScreenPointFromTile(
    tileX: number,
    tileY: number,
  ): { x: number; y: number } {
    const camera = this.cameras.main;
    const worldX = tileX * CELL_PX + CELL_PX / 2;
    const worldY = tileY * CELL_PX + CELL_PX / 2;
    return {
      x: (worldX - camera.scrollX) * camera.zoom,
      y: (worldY - camera.scrollY) * camera.zoom,
    };
  }

  private playCoinHudBump(): void {
    const hudCoin = this.add
      .circle(
        HUD_COIN_X,
        HUD_COIN_Y,
        HUD_COIN_BUMP_RADIUS_PX,
        COIN_AWARD_PARTICLE_COLOR,
        0.85,
      )
      .setDepth(COIN_AWARD_DEPTH + 1)
      .setScrollFactor(0);

    this.tweens.add({
      targets: hudCoin,
      scale: HUD_COIN_BUMP_SCALE,
      duration: HUD_COIN_BUMP_DURATION_MS / 2,
      ease: "Cubic.easeOut",
      yoyo: true,
      onComplete: () => hudCoin.destroy(),
    });
  }

  /**
   * Build the stone floor tilemap layer. Terrain is drawn by TileRenderer below it.
   */
  private buildLayers(): void {
    // === Stone floor spritesheet (single tile: 64�64) ===
    const floorCt = this.textures.createCanvas(
      "stone_floor_tiles",
      CELL_PX,
      CELL_PX,
    )!;
    const floorCtx = floorCt.context;

    floorCtx.fillStyle = STONE_FLOOR_BASE;
    floorCtx.fillRect(0, 0, CELL_PX, CELL_PX);

    for (const [bx, by, bw, bh, color] of STONE_FLOOR_BLOCKS) {
      floorCtx.fillStyle = color;
      floorCtx.fillRect(bx * 2, by * 2, bw * 2, bh * 2);
    }

    floorCtx.fillStyle = STONE_FLOOR_MORTAR_COLOR;
    for (const [mx, my, mw, mh] of STONE_FLOOR_MORTAR) {
      floorCtx.fillRect(mx * 2, my * 2, mw * 2, mh * 2);
    }
    floorCt.refresh();

    // === Tilemap for floor overlays (80x50, 64px tiles) ===
    const map = this.make.tilemap({
      width: GRID_W,
      height: GRID_H,
      tileWidth: CELL_PX,
      tileHeight: CELL_PX,
    });

    // Stone floor tileset + layer (initially empty, filled by applyFloorMap)
    const floorTs = map.addTilesetImage(
      "stone_floor_tiles",
      "stone_floor_tiles",
      CELL_PX,
      CELL_PX,
      0,
      0,
    )!;
    this.floorLayer = map.createBlankLayer("floor", floorTs)!;
    this.floorLayer.setDepth(1); // Above grass layer (depth 0)
    this.floorFirstGid = floorTs.firstgid;
  }
}

/**
 * Create and return a new Phaser.Game instance attached to the given parent element.
 * The canvas is transparent so the existing React-rendered grid shows through.
 */
export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent,
    transparent: true,
    scene: [WorldScene],
    // Disable all input � React still handles everything
    input: {
      mouse: false,
      touch: false,
      keyboard: false,
      gamepad: false,
    },
    banner: false,
    audio: { noAudio: true },
    render: {
      pixelArt: true,
      antialias: false,
    },
  });
}
