import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

function decodeMountPath(value: string): string {
  return value.replace(/\\040/g, " ").replace(/\\011/g, "\t").replace(/\\012/g, "\n").replace(/\\134/g, "\\");
}

function linuxMountPoints(): Set<string> {
  const raw = readFileSync("/proc/self/mountinfo", "utf8");
  const mountPoints = new Set<string>();

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const fields = line.split(" ");
    if (fields.length < 5) continue;
    mountPoints.add(path.resolve(decodeMountPath(fields[4])));
  }

  return mountPoints;
}

export function assertPersistentStorageMounted(): void {
  const required = env.requirePersistentStorage || (env.isProd && process.env.REQUIRE_PERSISTENT_STORAGE !== "false");
  if (!required) return;

  if (process.platform !== "linux") {
    throw new Error("Persistent storage guard can only verify mount points on Linux. Set REQUIRE_PERSISTENT_STORAGE=false only for non-Docker maintenance runs.");
  }

  const storagePath = path.resolve(process.cwd(), env.persistentStoragePath);
  const mountPoints = linuxMountPoints();

  if (!mountPoints.has(storagePath)) {
    throw new Error(
      `Persistent storage is not mounted at ${storagePath}. Refusing to start because SQLite data would be created on disposable container storage. ` +
        `In Dokploy, attach a persistent volume mounted exactly at ${storagePath}, then redeploy.`,
    );
  }
}
