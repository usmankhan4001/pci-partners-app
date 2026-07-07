// Thin fetch wrapper over Insforge's REST API (Postgres + S3-compatible
// storage, self-hosted at INSFORGE_API_BASE_URL). Insforge documents two
// header conventions across its API surface (an admin/schema `x-api-key`
// style used by its own tooling, and a data-plane `Authorization: Bearer`
// style documented for application REST calls) — we send both on every
// request so this keeps working regardless of which family a given
// endpoint expects, rather than guessing and risking silent 401s.
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { DownloadStrategyResponse, UploadedFile, UploadStrategyResponse } from "./types.js";

export class InsforgeError extends Error {
  constructor(
    public readonly operation: string,
    message: string,
  ) {
    super(`Insforge ${operation} failed: ${message}`);
  }
}

function authHeaders(): Record<string, string> {
  return {
    "x-api-key": env.insforgeApiKey,
    Authorization: `Bearer ${env.insforgeApiKey}`,
  };
}

async function request(operation: string, path: string, init: RequestInit = {}): Promise<Response> {
  if (!env.insforgeApiKey || !env.insforgeApiBaseUrl) {
    throw new InsforgeError(operation, "INSFORGE_API_KEY / INSFORGE_API_BASE_URL is not configured");
  }
  const res = await fetch(`${env.insforgeApiBaseUrl}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new InsforgeError(operation, `HTTP ${res.status} ${body.slice(0, 300)}`);
  }
  return res;
}

export async function runRawSql(query: string, params: unknown[] = []): Promise<void> {
  await request("runRawSql", `/api/database/advance/rawsql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, params }),
  });
}

// ── Database records ────────────────────────────────────────────

export async function insertRecord<T extends Record<string, unknown>>(table: string, record: T): Promise<T & { id: string }> {
  const res = await request("insertRecord", `/api/database/records/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify([record]),
  });
  const rows = (await res.json()) as Array<T & { id: string }>;
  return rows[0];
}

export async function updateRecord<T extends Record<string, unknown>>(
  table: string,
  id: string,
  patch: Partial<T>,
): Promise<void> {
  await request("updateRecord", `/api/database/records/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function listRecords<T>(table: string, query = ""): Promise<T[]> {
  const res = await request("listRecords", `/api/database/records/${table}${query ? `?${query}` : ""}`, {
    method: "GET",
  });
  return (await res.json()) as T[];
}

// ── Storage ──────────────────────────────────────────────────────

export async function uploadFile(
  bucket: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadedFile> {
  const strategyRes = await request("getUploadStrategy", `/api/storage/buckets/${bucket}/upload-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType, size: buffer.length }),
  });
  const strategy = (await strategyRes.json()) as UploadStrategyResponse;

  if (strategy.method === "direct") {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: contentType }), filename);
    await request("uploadDirect", `/api/storage/buckets/${bucket}/objects/${encodeURIComponent(strategy.key)}`, {
      method: "PUT",
      body: form,
    });
  } else {
    // Presigned (e.g. S3): POST directly to the presigned URL, outside our own API/auth.
    const form = new FormData();
    for (const [k, v] of Object.entries(strategy.fields ?? {})) form.append(k, v);
    form.append("file", new Blob([buffer], { type: contentType }), filename);
    const res = await fetch(strategy.uploadUrl, { method: "POST", body: form });
    if (!res.ok) {
      throw new InsforgeError("uploadPresigned", `HTTP ${res.status}`);
    }
  }

  if (strategy.confirmRequired && strategy.confirmUrl) {
    const confirmPath = strategy.confirmUrl.startsWith("http")
      ? strategy.confirmUrl.replace(env.insforgeApiBaseUrl, "")
      : strategy.confirmUrl;
    await request("confirmUpload", confirmPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ size: buffer.length, contentType }),
    });
  }

  const downloadRes = await request(
    "getDownloadStrategy",
    `/api/storage/buckets/${bucket}/download-strategy/objects/${encodeURIComponent(strategy.key)}`,
    { method: "GET" },
  );
  const download = (await downloadRes.json()) as DownloadStrategyResponse;

  return { key: strategy.key, url: download.url };
}

export async function ensureBucketExists(bucket: string, isPublic: boolean): Promise<void> {
  try {
    await request("listBuckets", `/api/storage/buckets`, { method: "GET" });
  } catch (err) {
    logger.error("Could not reach Insforge storage API", err);
    throw err;
  }
  await request("createBucket", `/api/storage/buckets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucketName: bucket, isPublic }),
  }).catch((err) => {
    // Already exists is the common/expected case on re-runs — anything else is worth surfacing.
    if (!String(err).toLowerCase().includes("exist")) throw err;
  });
}
