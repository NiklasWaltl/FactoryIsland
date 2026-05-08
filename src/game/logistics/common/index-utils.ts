import type { PlacedAsset } from "../../store/types";

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function assetHeight(
  asset: Pick<PlacedAsset, "height" | "size">,
): number {
  return asset.height ?? asset.size;
}

export function isWarehouseStorageAsset(
  asset: PlacedAsset | null | undefined,
): boolean {
  return (
    !!asset && (asset.type === "warehouse" || asset.isDockWarehouse === true)
  );
}
