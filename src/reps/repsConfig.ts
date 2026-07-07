// V2 has no CRM to pull sales reps from, so the ?rep= link + dropdown
// fallback are backed by a small local config file ops can edit directly —
// no rebuild needed, just edit data/reps.json and restart.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "../utils/logger.js";

export interface RepOption {
  id: string;
  name: string;
  designation: string;
}

const REPS_PATH = path.join(process.cwd(), "data", "reps.json");

export async function listReps(): Promise<RepOption[]> {
  try {
    const raw = await readFile(REPS_PATH, "utf8");
    return JSON.parse(raw) as RepOption[];
  } catch (err) {
    logger.error(`Could not read ${REPS_PATH}`, err);
    return [];
  }
}

export async function findRep(repId: string): Promise<RepOption | null> {
  const reps = await listReps();
  return reps.find((r) => r.id === repId) ?? null;
}
