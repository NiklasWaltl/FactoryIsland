import Phaser from "phaser";
import type { TileType } from "./tile-types";

const TILE_COLORS: Record<TileType, number> = {
  grass: 0x4a7c3f,
  sand: 0xc8a96e,
  water: 0x2e6b9e,
};

const GRID_OVERLAY_COLOR = 0x000000;
const GRID_OVERLAY_ALPHA = 0.04;
const WATER_SHIMMER_COLOR = 0xb8e0ff;
const WATER_SHIMMER_ALPHA = 0.24;

export class TileRenderer {
  private layer: Phaser.GameObjects.Graphics;
  private sentToBack = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileSize: number,
  ) {
    this.layer = scene.add.graphics();
    this.layer.setDepth(0);
  }

  /**
   * Zeichnet die gesamte tileMap neu.
   * Wird beim initialen Mount und bei tileMap-Aenderungen aufgerufen.
   */
  render(tileMap: TileType[][]): void {
    this.layer.clear();

    for (let row = 0; row < tileMap.length; row++) {
      const tiles = tileMap[row];
      for (let col = 0; col < tiles.length; col++) {
        const tile = tiles[col];
        const x = col * this.tileSize;
        const y = row * this.tileSize;

        this.layer.fillStyle(TILE_COLORS[tile], 1);
        this.layer.fillRect(x, y, this.tileSize, this.tileSize);

        if (tile === "water") {
          this.drawWaterShimmer(row, col, x, y);
        }

        this.layer.lineStyle(1, GRID_OVERLAY_COLOR, GRID_OVERLAY_ALPHA);
        this.layer.strokeRect(x, y, this.tileSize, this.tileSize);
      }
    }

    if (!this.sentToBack) {
      this.scene.children.sendToBack(this.layer);
      this.sentToBack = true;
    }
  }

  destroy(): void {
    this.layer.destroy();
  }

  private drawWaterShimmer(
    row: number,
    col: number,
    x: number,
    y: number,
  ): void {
    const offsetX = 12 + ((col * 17 + row * 7) % (this.tileSize - 24));
    const offsetY = 12 + ((row * 19 + col * 11) % (this.tileSize - 24));
    this.layer.fillStyle(WATER_SHIMMER_COLOR, WATER_SHIMMER_ALPHA);
    this.layer.fillCircle(x + offsetX, y + offsetY, 2);
  }
}
