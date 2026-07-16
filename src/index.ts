// chdir to the project root before anything else loads, so relative paths
// (dotenv's .env, public/, internal/, templates/, data/) resolve correctly
// regardless of the directory the process was actually launched from.
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(projectRoot);

const { assertPersistentStorageMounted } = await import("./storage/persistenceGuard.js");
assertPersistentStorageMounted();

const { createApp } = await import("./app.js");
const { env } = await import("./config/env.js");
const { logger } = await import("./utils/logger.js");

const app = createApp();

app.listen(env.port, () => {
  logger.info(`PCI Sales Partner Registration V2 listening on :${env.port} (${env.nodeEnv})`);
});
