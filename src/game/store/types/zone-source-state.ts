/** A production zone groups warehouses and crafting buildings into a shared local resource pool. */
export interface ProductionZone {
  id: string;
  name: string;
  color?: string;
}

export interface ZoneSourceState {
  buildingSourceWarehouseIds: Record<string, string>;
  productionZones: Record<string, ProductionZone>;
  buildingZoneIds: Record<string, string>;
}
