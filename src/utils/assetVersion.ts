// A stale cached copy of /app.js (browser or an intermediary CDN) serving
// alongside freshly-deployed HTML is exactly the kind of bug where new
// markup appears (e.g. a new <canvas>) but the JS that wires it up is the
// old version and never heard of it. Since these assets are referenced by
// a fixed URL with no cache-busting, nothing forces a stale cache to drop
// them on deploy. Fix: version the URL with a hash of the file's own
// content, computed once at startup — any content change produces a new
// URL, which no cache (however aggressive) can serve stale.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

function hashFile(relPath: string): string {
  try {
    const contents = readFileSync(path.join(process.cwd(), "public", relPath));
    return createHash("sha1").update(contents).digest("hex").slice(0, 10);
  } catch {
    return "0";
  }
}

export const ASSET_VERSION = {
  appJs: hashFile("app.js"),
  stylesCss: hashFile("styles.css"),
};

export function withAssetVersion(html: string): string {
  return html
    .replace('src="/app.js"', `src="/app.js?v=${ASSET_VERSION.appJs}"`)
    .replace('href="/styles.css"', `href="/styles.css?v=${ASSET_VERSION.stylesCss}"`);
}
