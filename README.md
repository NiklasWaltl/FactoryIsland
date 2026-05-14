<h1 align="center">Factory Island</h1>

A 2D factory-building game. Mine resources, transport them via conveyor belts,
process them in machines, and build an energy grid to power your island.

Built with React 19, TypeScript 5.9, Phaser 3.80, Vite 5, React Compiler, Jest, ESLint and Prettier.

---

# Getting Started

### Prerequisites

- Node.js 22+
- Yarn 1.x (`npm install -g yarn`)

### Install

```bash
yarn install
```

### Development

```bash
yarn dev
```

Opens the game at `http://localhost:3000/`.

### Production Build

```bash
yarn build
```

Output goes to `dist-factory/`.

### Preview Production Build

```bash
yarn preview
```

### Run Tests

```bash
yarn test
```

---

# Project Structure

| Ordner        | Beschreibung                                     |
| ------------- | ------------------------------------------------ |
| `buildings/`  | Building definitions and placement logic         |
| `crafting/`   | Crafting queue, reservations, keep-stock         |
| `drones/`     | Drone units and service hub logic                |
| `inventory/`  | Inventory management                             |
| `items/`      | Item registry and definitions                    |
| `logistics/`  | Conveyor belts, splitters, underground conveyors |
| `modules/`    | Module Lab, modules, fragments                   |
| `power/`      | Energy grid and priority system                  |
| `ship/`       | Ship and dock quest system                       |
| `zones/`      | Production zones                                 |
| `simulation/` | Tick system, save/load, recipes                  |

`src/game/` # All Factory Island game source code (uses React and Phaser)

`index.factory.html` # Vite HTML entry point
`public/factory/` # Public assets (favicon.svg, sprites, etc.)

## Configuration

Vite uses `vite.factory.config.ts`. Key settings:

- Entry: `index.factory.html`, served at `/`
- Dev server: port `3000`
- Output: `dist-factory/`, base path `./`
- Phaser is split into a dedicated chunk for optimal loading
- React Compiler is enabled via the Babel plugin

## Development & Debug

When running with `yarn dev`, `import.meta.env.DEV` enables:

- Debug overlay and invariant checks
- HMR state restore
- Relaxed build limits
- Dev scenes accessible via URL parameter

**Dev scenes:** append `?scene=debug|logistics|power|assembler|empty` to the dev URL.

## Architecture Overview

React owns all state via a central `useReducer`. The data flow is strictly one-directional:

- UI events, tick intervals, and keyboard handlers **dispatch actions**
- Phaser receives **read-only state snapshots** and must never dispatch
- All periodic dispatches share a central BASE_TICK orchestrator in `use-game-ticks.ts` (three setIntervals total: Natural Spawn, Sapling Polling, and the BASE_TICK orchestrator that fires `GENERATOR_TICK → ENERGY_NET_TICK → LOGISTICS_TICK → DRONE_TICK → JOB_TICK` plus the independent workbench/lab/ship/notification ticks at their configured cadences)
- Reducer dispatch is mid-migration: bounded-context reducers in `store/contexts/` handle a growing list of action types live; the remaining actions still flow through the legacy cluster dispatch chain in `store/game-reducer-dispatch.ts` (with a DEV shadow-diff that compares both paths). See [`docs/bounded-context-state-management-prd.md`](docs/bounded-context-state-management-prd.md).

## Persistence

Game state is saved to `localStorage` under the key `factory-island-save`:

- Auto-save every **10 seconds** and on `beforeunload`
- Save codec is **whitelist-based** (only known fields are serialized)
- Migration chain currently runs V0 → **V32** (`CURRENT_SAVE_VERSION` in [`src/game/simulation/migrations/types.ts`](src/game/simulation/migrations/types.ts))
- In DEV mode: HMR state snapshot is preserved across hot reloads

## Features

- **Drones & Service Hubs** – autonomous item transport units
- **Crafting Queue** – with item reservations and keep-stock targets
- **Production Zones** – area-based production management
- **Ship & Dock Quests** – progression through shipping goals
- **Module Lab** – research modules from fragments
- **Splitter Filters** – route items by type on belt networks
- **Underground Conveyors** – cross terrain without surface belts
- **Energy Priority** – configurable power priority per building
- **Dev Scenes** – isolated test environments for subsystems

## Data & Registries

All game data is defined in central registries:

| Registry          | Contents                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Item Registry     | All items with IDs, names, icons, stack sizes                                                                                                                 |
| Building Registry | All buildings with build-menu categories and properties                                                                                                       |
| Recipe Tables     | Workbench, Smelting, Manual Assembler, Auto Assembler V1 (`src/game/simulation/recipes/`) and Module Lab recipes (`src/game/constants/moduleLabConstants.ts`) |

## Testing

Tests run with **Jest 27** in a `jsdom` environment. Configuration files:

| File                       | Purpose                                |
| -------------------------- | -------------------------------------- |
| `jest.config.js`           | Main Jest configuration                |
| `tsconfig.test.json`       | TypeScript config for test environment |
| `setup.ts`                 | Global test setup                      |
| `importMetaTransformer.js` | Transforms `import.meta.env` for Jest  |

Test files are colocated with source code under `src/game/**/__tests__/`.

```bash
yarn test          # Run all tests
yarn test:silent   # Run without verbose output
```

## Lint / Format

```bash
yarn lint    # ESLint with React, React Hooks, TypeScript, Prettier, unused-imports rules
yarn format  # Run ESLint --fix (Prettier is enforced via eslint-plugin-prettier)
```

Active ESLint rules include `no-console` and `react/jsx-no-literals`.

## CI / Deployment

Three GitHub Actions workflows are configured:

| Workflow                                             | Trigger                                          | Steps                                      |
| ---------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| CI                                                   | Pull Request (to `main`)                         | Frozen install → typecheck → tests → lint  |
| Factory Island standalone deploy                     | Push to `main` (path-filtered) + manual dispatch | Build → upload `dist-factory/` as artifact |
| Perform a code review when a pull request is created | Pull Request (`opened`)                          | Automated code review via Codex            |

> Note: S3 deployment is scaffolded in the deploy workflow but currently commented out.

## Further Documentation

See [ARCHITECTURE.md](src/game/ARCHITECTURE.md) for full technical documentation.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and fixes.

See [AGENTS.md](AGENTS.md) for AI coding agent guidelines.

- [`SYSTEM_REGISTRY.md`](SYSTEM_REGISTRY.md) – Central system and module registry
- [`src/game/TYPES.md`](src/game/TYPES.md) – Shared TypeScript type documentation
- Subsystem READMEs:
  - [`src/game/crafting/README.md`](src/game/crafting/README.md)
  - [`src/game/simulation/README.md`](src/game/simulation/README.md)
  - [`src/game/store/action-handlers/logistics-tick/README.md`](src/game/store/action-handlers/logistics-tick/README.md)

---

# Build

| Command                                      | Purpose                                                           | Config                                             |
| -------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| `yarn dev`                                   | Development server                                                | `vite.factory.config.ts`                           |
| `yarn build`                                 | Production build                                                  | `vite.factory.config.ts` + `tsconfig.factory.json` |
| `yarn preview`                               | Preview production build                                          | `vite.factory.config.ts`                           |
| `yarn test`                                  | Run tests                                                         | `jest.config.js`                                   |
| `yarn test:silent`                           | Run tests without verbose output                                  | `jest.config.js`                                   |
| `yarn lint`                                  | Lint source files                                                 | ESLint                                             |
| `yarn format`                                | Run ESLint auto-fixes (`eslint --fix`), including Prettier checks | `.eslintrc.js` + `.prettierrc.json`                |
| `yarn prepare`                               | Husky setup (runs automatically after install)                    | `package.json`                                     |
| `yarn tsc -p tsconfig.factory.json --noEmit` | Typecheck without emitting files (used in CI)                     | `tsconfig.factory.json`                            |

---

# License

This project is private and not publicly licensed (`UNLICENSED`). The `LICENSE` file is retained for reference only.
