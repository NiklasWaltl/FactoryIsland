import { migrateV0ToV1 } from "../save-legacy";
import { step } from "./helpers";
import {
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  migrateV4ToV5,
  migrateV5ToV6,
  migrateV6ToV7,
  migrateV7ToV8,
  migrateV8ToV9,
  migrateV9ToV10,
} from "./v01-v10";
import {
  migrateV10ToV11,
  migrateV11ToV12,
  migrateV12ToV13,
  migrateV13ToV14,
  migrateV14ToV15,
  migrateV15ToV16,
  migrateV16ToV17,
  migrateV17ToV18,
  migrateV18ToV19,
  migrateV19ToV20,
} from "./v11-v20";
import {
  migrateV20ToV21,
  migrateV21ToV22,
  migrateV22ToV23,
  migrateV23ToV24,
  migrateV24ToV25,
  migrateV25ToV26,
  migrateV26ToV27,
  migrateV27ToV28,
  migrateV28ToV29,
  migrateV29ToV30,
} from "./v21-v30";
import { migrateV30ToV31 } from "./v31";
import { migrateV31ToV32 } from "./v32";
import {
  CURRENT_SAVE_VERSION,
  type MigrationStep,
  type SaveGameLatest,
} from "./types";

export { CURRENT_SAVE_VERSION } from "./types";
export type {
  SaveGameV1,
  SaveGameV2,
  SaveGameV3,
  SaveGameV4,
  SaveGameV5,
  SaveGameV6,
  SaveGameV7,
  SaveGameV8,
  SaveGameV9,
  SaveGameV10,
  SaveGameV11,
  SaveGameV12,
  SaveGameV13,
  SaveGameV14,
  SaveGameV15,
  SaveGameV16,
  SaveGameV17,
  SaveGameV18,
  SaveGameV19,
  SaveGameV20,
  SaveGameV21,
  SaveGameV22,
  SaveGameV23,
  SaveGameV24,
  SaveGameV25,
  SaveGameV26,
  SaveGameV27,
  SaveGameV28,
  SaveGameV29,
  SaveGameV30,
  SaveGameV31,
  SaveGameV32,
  SaveGameLatest,
} from "./types";
export { clampGeneratorFuel } from "./helpers";

const MIGRATIONS: MigrationStep[] = [
  step(0, 1, migrateV0ToV1),
  step(1, 2, migrateV1ToV2),
  step(2, 3, migrateV2ToV3),
  step(3, 4, migrateV3ToV4),
  step(4, 5, migrateV4ToV5),
  step(5, 6, migrateV5ToV6),
  step(6, 7, migrateV6ToV7),
  step(7, 8, migrateV7ToV8),
  step(8, 9, migrateV8ToV9),
  step(9, 10, migrateV9ToV10),
  step(10, 11, migrateV10ToV11),
  step(11, 12, migrateV11ToV12),
  step(12, 13, migrateV12ToV13),
  step(13, 14, migrateV13ToV14),
  step(14, 15, migrateV14ToV15),
  step(15, 16, migrateV15ToV16),
  step(16, 17, migrateV16ToV17),
  step(17, 18, migrateV17ToV18),
  step(18, 19, migrateV18ToV19),
  step(19, 20, migrateV19ToV20),
  step(20, 21, migrateV20ToV21),
  step(21, 22, migrateV21ToV22),
  step(22, 23, migrateV22ToV23),
  step(23, 24, migrateV23ToV24),
  step(24, 25, migrateV24ToV25),
  step(25, 26, migrateV25ToV26),
  step(26, 27, migrateV26ToV27),
  step(27, 28, migrateV27ToV28),
  step(28, 29, migrateV28ToV29),
  step(29, 30, migrateV29ToV30),
  step(30, 31, migrateV30ToV31),
  step(31, 32, migrateV31ToV32),
];

export function migrateSave(raw: unknown): SaveGameLatest | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  let version: number =
    typeof data.version === "number" && Number.isFinite(data.version)
      ? data.version
      : 0;

  if (version > CURRENT_SAVE_VERSION) {
    // eslint-disable-next-line no-console -- load-time save incompatibility diagnostics should reach DEV consoles.
    console.warn(
      `[save] Save version ${version} is newer than code version ${CURRENT_SAVE_VERSION}. Ignoring save.`,
    );
    return null;
  }

  let save: unknown = data;
  for (const step of MIGRATIONS) {
    if (version === step.from) {
      save = step.migrate(save);
      version = step.to;
    }
  }

  if (version !== CURRENT_SAVE_VERSION) {
    // eslint-disable-next-line no-console -- load-time save corruption diagnostics should reach DEV consoles.
    console.warn(
      `[save] Migration ended at v${version}, expected v${CURRENT_SAVE_VERSION}. Save may be corrupted.`,
    );
    return null;
  }

  return save as SaveGameLatest;
}
