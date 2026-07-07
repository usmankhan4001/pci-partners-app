// One-time (safe to re-run) Insforge provisioning: creates the sales_partners
// table (raw SQL, idempotent via IF NOT EXISTS) and the documents storage
// bucket. Run with INSFORGE_API_BASE_URL / INSFORGE_API_KEY set in .env.
import "dotenv/config";
import { env } from "../src/config/env.js";
import { ensureBucketExists, runRawSql } from "../src/insforge/client.js";
import { createTableSql } from "../src/insforge/schema.js";

async function main() {
  if (!env.insforgeApiKey || !env.insforgeApiBaseUrl) {
    console.error("INSFORGE_API_KEY / INSFORGE_API_BASE_URL must be set in .env first.");
    process.exit(1);
  }

  console.log(`== Insforge setup: ${env.insforgeApiBaseUrl} ==\n`);

  console.log(`Creating table "${env.insforgeTable}" (if not already present)...`);
  await runRawSql(createTableSql());
  console.log("  done.");

  console.log(`\nCreating bucket "${env.insforgeBucket}" (if not already present)...`);
  await ensureBucketExists(env.insforgeBucket, true);
  console.log("  done.");

  console.log("\nSetup complete. Verify the table/bucket in your Insforge dashboard.");
}

main().catch((err) => {
  console.error("\nSetup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
