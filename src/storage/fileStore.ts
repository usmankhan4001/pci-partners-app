// Local disk file storage — replaces Insforge's S3-compatible bucket.
// Files live under env.uploadsDir (same Docker volume as the SQLite DB) and
// are served back out by a static route mounted at /uploads in app.ts.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

// Keys are server-constructed as `${record.id}/${filename}` — record.id is
// a UUID we generate, but filename comes from the uploaded file's original
// name, so it must be sanitized before touching the filesystem.
function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || "file";
}

export async function saveFile(key: string, buffer: Buffer): Promise<{ url: string }> {
  const [id, ...rest] = key.split("/");
  const filename = sanitizeFilename(rest.join("/") || "file");
  const dir = path.join(env.uploadsDir, id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return { url: `/uploads/${id}/${encodeURIComponent(filename)}` };
}

export async function readStoredFile(url: string): Promise<{ filename: string; buffer: Buffer }> {
  const match = /^\/uploads\/([^/]+)\/([^/]+)$/.exec(url);
  if (!match) throw new Error(`Invalid stored file URL: ${url}`);
  const id = match[1];
  const filename = sanitizeFilename(decodeURIComponent(match[2]));
  const buffer = await readFile(path.join(env.uploadsDir, id, filename));
  return { filename, buffer };
}
