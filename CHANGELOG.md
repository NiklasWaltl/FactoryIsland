# Changelog

All notable changes to **Factory Island** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

> Features planned per GDD that are not yet implemented:
> - On-chain module minting (NFT layer)
> - Module bonus effects applied to buildings
> - Ship quest phases 4 & 5

---

## [0.3.0] – 2026-05-03 · Module System

### Added
- **Module Lab** – new 2×2 crafting station for the NFT module system
  - Three-tier recipes: T1 (3 fragments / 10 s), T2 (5 / 20 s), T3 (8 / 40 s)
  - Three-tab panel: Fragmente / Aktiver Job / Meine Module
  - Live progress bar and disabled-when-insufficient craft buttons
  - Actions: `START_MODULE_CRAFT`, `MODULE_LAB_TICK`, `COLLECT_MODULE`, `PLACE_MODULE`, `REMOVE_MODULE`
  - Save v26 migration adds `moduleLabJob: null`
  - Sprite placeholder (purple SVG with flask icon)
- **Miner-Boost yield multiplier** in auto-miner tick (module slot effect, first active module bonus)
- **Module fragments** state counter (`moduleFragments[]`) added to `GameState` (save v24)
  - `COLLECT_FRAGMENT` action; ship rewards land in `moduleFragments` instead of inventory
- **Fragment Trader** building – UI panel, state and `TRADE_FRAGMENT` action; gets own router key to avoid colliding with Dock Warehouse panel
- Tick interval for Module Lab (500 ms, runs only while a job is in-flight)

### Fixed
- `DockWarehousePanel` restored after fragment trader was assigned a conflicting panel router key

### Tests
- 6 new reducer tests for Module Lab (insufficient fragments, job-already-active, pre/post-duration tick, `COLLECT_MODULE`, ship fragment reward routing)
- Total test count: **920 tests** (save v27, code-scan v0.3)

---

## [0.2.0] – 2026-05-02 · Ship & Dock Quest System

### Added
- **Ship system** – full lifecycle: `sailing → docked → sailing`
  - `ShipStatus`, `ShipQuest`, `ShipReward`, `ShipState` types
  - Phase-based quest pools (phases 1–3 filled; 4–5 stubbed)
  - Weighted reward table: coins ~50 %, basic loot ~25 %, rare ~15 %, fragment ~8 %, module ~2 %
  - `drawReward(multiplier, questPhase)` in `reward-table.ts`
  - Actions: `SHIP_TICK`, `SHIP_DOCK`, `SHIP_DEPART`, `SHIP_RETURN`
  - Quality multiplier: ≥100 % delivery → 1×, ≥150 % → 2×, ≥200 % → 3×
  - `SHIP_TICK_MS = 1000 ms`, registered in `useGameTicks`
- **Dock Warehouse** building
  - Fixed 2×2 placement at beach tile row (bottom-center of core area)
  - `isDockWarehouse` flag, `getDockWarehousePos` / `getDockWarehouseInputTile` helpers
  - `applyDockWarehouseLayout` bootstrap with save V22 migration
  - `DockWarehousePanel`: active quest, delivery progress, quality indicator, drop hints
  - Wired into conveyor routing and drone planner
- **Ship sprite** rendered in Phaser scene at water edge (docked/hidden-while-sailing)
- **ShipStatusBar** HUD (top-center) with countdown timer and next quest preview
- **Coin particle animation** on `SHIP_RETURN`
- `pendingMultiplier` field added to `ShipState` + migration default

### Fixed
- `SHIP_DEPART` no longer caps `delivered` at `quest.amount` before multiplier calculation
- Ship sprite aligned to correct beach tile row

### Refactor
- `MAP_SHOP_POS` constant fully removed; replaced by `getStartModulePosition` helper with three-level fallback chain (materialized start asset → tile-map anchor → legacy literal)
- `applyBaseStartLayout` extracted to `store/bootstrap/apply-base-start-layout.ts`
- `HUB_SEARCH_CENTER` local constant introduced in `save-codec.ts`
- `tileMap` threaded into `sanitizeStarterDrone`

### Tests
- 25 ship lifecycle & reward tests (status transitions, quality multiplier, `shipsSinceLastFragment`, `drawReward` distribution)
- Migration path coverage for V3→V4 and V11→V12 drone position defaults
- Fresh-state layout invariant integration test (tilemap rectangularity, core area, fixed deposit positions, starter buildup)

---

## [0.1.5] – 2026-05-01 · Logistics Enhancements

### Added
- **Splitter Filter Routing & Panel** (save v20)
  - Per-splitter item filter persisted in `GameState`
  - `ConveyorSplitterPanel` UI
  - 5 new tests (737 total)
- **Splitter Round-Robin routing** (save v19)
- **Scene Selector** – dev utility for switching isolated test scenes via URL parameter (`?scene=debug|logistics|power|assembler|empty`)
- Logistics-tick canonical order documented with regression guard test

### Refactor
- `resolveWorkbenchSource` and `CraftingSource` re-exports removed from `reducer-public-api` (dead-code cleanup)
- Prettier formatting applied repo-wide

---

## [0.1.0] – Early Development · Core Systems

### Added
- **Drones & Service Hubs** – autonomous item transport with assignment, movement and pathfinding
- **Crafting Queue** – workbench crafting with item reservations and keep-stock targets
- **Conveyor Belts, Splitters, Underground Conveyors** – full logistics layer
- **Energy Grid & Priority System** – configurable power priority per building
- **Production Zones** – area-based production management
- **Auto-Miner Tick** – passive resource collection from ore deposits
- **Save / Load system** – whitelist-based codec, migration chain (v1 → v27), auto-save every 10 s and on `beforeunload`
- **Item, Building and Recipe registries** – central data definitions for all game entities
- **Phaser 3 scene** with isometric-style 2D rendering, tile map, drone sprites, collection-node sprites
- **React 19 UI shell** – panels, HUD, build menu, notification system
- **Dev scenes** – isolated subsystem test environments
- **CI workflows** – PR CI (typecheck + tests + lint), Standalone Deploy, Copilot PR Review

---

> **Save version reference**
>
> | Save Version | Introduced by |
> |---|---|
> | v27 | Module Lab job field (`moduleLabJob`) – code-scan v0.3 |
> | v26 | Module Lab job field (`moduleLabJob`) |
> | v24 | `moduleFragments[]` counter |
> | v22 | Dock Warehouse bootstrap |
> | v20 | Splitter filter routing |
> | v19 | Splitter round-robin routing |
> | v18 | Splitter base state |
> | v12 | Starter-drone fallback migration |
> | v4  | Initial drone position migration |
