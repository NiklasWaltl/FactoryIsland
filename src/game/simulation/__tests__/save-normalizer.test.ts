import { createInitialState } from "../../store/initial-state";
import { getStartModulePosition } from "../../store/bootstrap/start-module-position";
import type { CraftingJob } from "../../crafting/types";
import type { GameState } from "../../store/types";
import { deserializeState, serializeState } from "../save";
import {
  sanitizeCraftingQueue,
  sanitizeNetworkSlice,
  sanitizeStarterDrone,
} from "../save-normalizer";

function buildState(): GameState {
  const state = createInitialState("release");

  state.assets["wb-test"] = {
    id: "wb-test",
    type: "workbench",
    x: 12,
    y: 12,
    size: 1,
  };
  state.cellMap["12,12"] = "wb-test";

  return state;
}

describe("save-normalizer", () => {
  describe("sanitizeCraftingQueue", () => {
    it("entfernt done/cancelled Jobs, entfernt Jobs mit fehlender workbenchId und stabilisiert nextJobSeq", () => {
      const state = buildState();
      const save = serializeState(state) as any;

      const validJob: CraftingJob = {
        id: "10",
        recipeId: "wood_pickaxe",
        workbenchId: "wb-test",
        inventorySource: { kind: "global" },
        inputBuffer: [],
        status: "queued",
        priority: "normal",
        source: "player",
        enqueuedAt: 10,
        startedAt: null,
        finishesAt: null,
        progress: 0,
        ingredients: [{ itemId: "wood", count: 1 }],
        output: { itemId: "wood_pickaxe", count: 1 },
        processingTime: 5,
        reservationOwnerId: "10",
      };

      save.crafting = {
        jobs: [
          validJob,
          { ...validJob, id: "11", status: "done", enqueuedAt: 11 },
          {
            ...validJob,
            id: "12",
            status: "cancelled",
            enqueuedAt: 12,
          },
          {
            ...validJob,
            id: "20",
            workbenchId: "wb-missing",
            enqueuedAt: 20,
          },
        ],
        nextJobSeq: 1,
        lastError: { kind: "UNKNOWN_JOB", message: "stale" },
      };

      const loaded = deserializeState(save);

      expect(loaded.crafting.jobs.map((job) => job.id)).toEqual(["10"]);
      expect(loaded.crafting.nextJobSeq).toBe(11);
      expect(loaded.crafting.lastError).toBeNull();
    });

    it("wirft bei leerer Queue nach Sanitize keine Exception", () => {
      const state = buildState();
      const save = serializeState(state) as any;

      save.crafting = {
        jobs: [
          {
            id: "1",
            recipeId: "wood_pickaxe",
            workbenchId: "wb-missing",
            inventorySource: { kind: "global" },
            inputBuffer: [],
            status: "done",
            priority: "normal",
            source: "player",
            enqueuedAt: 1,
            startedAt: null,
            finishesAt: null,
            progress: 0,
            ingredients: [{ itemId: "wood", count: 1 }],
            output: { itemId: "wood_pickaxe", count: 1 },
            processingTime: 5,
            reservationOwnerId: "1",
          },
        ],
        nextJobSeq: 1,
        lastError: { kind: "UNKNOWN_JOB", message: "stale" },
      };

      expect(() => deserializeState(save)).not.toThrow();
      const loaded = deserializeState(save);
      expect(loaded.crafting.jobs).toEqual([]);
    });
  });

  describe("sanitizeNetworkSlice", () => {
    it("entfernt crafting_job Reservierungen ohne Live-Job, behaelt system_request und setzt lastError zurueck", () => {
      const state = buildState();
      const save = serializeState(state) as any;

      save.crafting = {
        jobs: [
          {
            id: "10",
            recipeId: "wood_pickaxe",
            workbenchId: "wb-test",
            inventorySource: { kind: "global" },
            inputBuffer: [],
            status: "queued",
            priority: "normal",
            source: "player",
            enqueuedAt: 10,
            startedAt: null,
            finishesAt: null,
            progress: 0,
            ingredients: [{ itemId: "wood", count: 1 }],
            output: { itemId: "wood_pickaxe", count: 1 },
            processingTime: 5,
            reservationOwnerId: "10",
          },
        ],
        nextJobSeq: 11,
        lastError: null,
      };

      save.network = {
        reservations: [
          {
            id: "r10",
            itemId: "wood",
            amount: 2,
            ownerKind: "crafting_job",
            ownerId: "10",
            createdAt: 100,
          },
          {
            id: "r99",
            itemId: "stone",
            amount: 3,
            ownerKind: "crafting_job",
            ownerId: "99",
            createdAt: 100,
          },
          {
            id: "sys1",
            itemId: "iron",
            amount: 1,
            ownerKind: "system_request",
            ownerId: "auto",
            createdAt: 100,
          },
        ],
        nextReservationId: 1,
        lastError: { kind: "UNKNOWN_RESERVATION", message: "stale" },
      };

      const loaded = deserializeState(save);

      expect(loaded.network.reservations).toEqual([
        expect.objectContaining({ ownerKind: "crafting_job", ownerId: "10" }),
        expect.objectContaining({
          ownerKind: "system_request",
          ownerId: "auto",
        }),
      ]);
      expect(
        loaded.network.reservations.some(
          (reservation) =>
            reservation.ownerKind === "crafting_job" &&
            reservation.ownerId === "99",
        ),
      ).toBe(false);
      expect(loaded.network.lastError).toBeNull();
    });
  });

  describe("sanitizeStarterDrone", () => {
    it("setzt ungueltigen Drone-Status auf idle", () => {
      const state = buildState();
      const save = serializeState(state) as any;

      save.drones["starter"] = {
        ...save.drones["starter"],
        status: "flying_to_unknown",
      };

      const loaded = deserializeState(save);
      expect(loaded.drones["starter"].status).toBe("idle");
    });

    it("behaelt gueltigen Deconstruct-Refund nach Sanitize", () => {
      const state = buildState();
      const save = serializeState(state) as any;

      save.drones["starter"] = {
        ...save.drones["starter"],
        status: "moving_to_dropoff",
        deconstructRefund: { wood: 4, stone: 2 },
      };

      const loaded = deserializeState(save);
      expect(loaded.drones["starter"].deconstructRefund).toEqual({
        wood: 4,
        stone: 2,
      });
    });

    it("setzt bei fehlender Position eine TileMap-Fallbackposition statt null", () => {
      const state = buildState();
      const save = serializeState(state);
      const expected = getStartModulePosition({
        assets: {},
        tileMap: save.tileMap,
      });

      const sanitized = sanitizeStarterDrone(
        {
          ...(save.drones["starter"] as any),
          tileX: undefined,
          tileY: undefined,
          status: "idle",
        },
        save.tileMap,
      );

      expect(sanitized.tileX).toBe(expected.x);
      expect(sanitized.tileY).toBe(expected.y);
      expect(sanitized.tileX).not.toBeNull();
      expect(sanitized.tileY).not.toBeNull();
    });
  });

  describe("roundtrip invariants", () => {
    it("bleibt nach serialize -> Korruption -> deserialize ein valider GameState", () => {
      const state = buildState();
      const save = serializeState(state) as any;

      save.crafting = {
        jobs: [
          null,
          {
            id: "broken",
            recipeId: "wood_pickaxe",
            workbenchId: "wb-missing",
            inventorySource: { kind: "global" },
            status: "cancelled",
            priority: "normal",
            source: "player",
            enqueuedAt: 1,
            startedAt: null,
            finishesAt: null,
            progress: 0,
            ingredients: [{ itemId: "wood", count: 1 }],
            output: { itemId: "wood_pickaxe", count: 1 },
            processingTime: 1,
            reservationOwnerId: "broken",
          },
        ],
        nextJobSeq: 1,
        lastError: { kind: "UNKNOWN_JOB", message: "stale" },
      };

      save.network = {
        reservations: [
          {
            id: "bad",
            itemId: "wood",
            amount: -5,
            ownerKind: "crafting_job",
            ownerId: "missing",
            createdAt: 1,
          },
        ],
        nextReservationId: 0,
        lastError: { kind: "UNKNOWN_RESERVATION", message: "stale" },
      };

      save.drones["starter"] = {
        ...save.drones["starter"],
        status: "flying_to_unknown",
        tileX: undefined,
        tileY: undefined,
      };

      const loaded = deserializeState(save);

      expect(
        Object.values(loaded.assets).every((asset) => asset !== undefined),
      ).toBe(true);
      expect(loaded.crafting).toBeDefined();
      expect(Array.isArray(loaded.crafting.jobs)).toBe(true);
      expect(loaded.inventory).toBeDefined();
      expect(
        Object.values(loaded.inventory).every(
          (value) => typeof value === "number" && Number.isFinite(value),
        ),
      ).toBe(true);
    });
  });

  describe("direct sanitizer safety", () => {
    it("sanitizeCraftingQueue wirft bei leerer Queue nicht", () => {
      expect(() =>
        sanitizeCraftingQueue(
          {
            jobs: [],
            nextJobSeq: 1,
            lastError: { kind: "UNKNOWN_JOB", message: "stale" },
          },
          new Set(),
        ),
      ).not.toThrow();
    });

    it("sanitizeNetworkSlice entfernt stale crafting_job und behaelt system_request", () => {
      const sanitized = sanitizeNetworkSlice(
        {
          reservations: [
            {
              id: "r1",
              itemId: "wood",
              amount: 1,
              ownerKind: "crafting_job",
              ownerId: "job-missing",
              createdAt: 1,
            },
            {
              id: "r2",
              itemId: "stone",
              amount: 2,
              ownerKind: "system_request",
              ownerId: "sys",
              createdAt: 1,
            },
          ],
          nextReservationId: 1,
          lastError: { kind: "UNKNOWN_RESERVATION", message: "stale" },
        },
        new Set(),
      );

      expect(sanitized.reservations).toEqual([
        expect.objectContaining({
          ownerKind: "system_request",
          ownerId: "sys",
        }),
      ]);
      expect(sanitized.lastError).toBeNull();
    });
  });
});
