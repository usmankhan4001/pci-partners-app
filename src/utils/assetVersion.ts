// A stale cached copy of a JS/CSS file (browser or an intermediary CDN)
// serving alongside freshly-deployed HTML is exactly the kind of bug where
// new markup appears but the script that wires it up is an old version that
// never heard of it. Since these assets are referenced by a fixed URL with
// no cache-busting, nothing forces a stale cache to drop them on deploy.
// Fix: version each URL with a hash of that file's own content, computed
// once at startup — any content change produces a new URL, which no cache
// (however aggressive) can serve stale.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const hashCache = new Map<string, string>();

function hashFile(relPath: string): string {
  const cached = hashCache.get(relPath);
  if (cached) return cached;
  let hash: string;
  try {
    const contents = readFileSync(path.join(process.cwd(), "public", relPath));
    hash = createHash("sha1").update(contents).digest("hex").slice(0, 10);
  } catch {
    hash = "0";
  }
  hashCache.set(relPath, hash);
  return hash;
}

// Rewrites every same-origin `src="/foo.js"` and `href="/foo.css"` reference
// in the given HTML to `?v=<content-hash-of-foo.js>`, without needing each
// caller to name its specific assets up front.
export function withAssetVersion(html: string): string {
  return html.replace(/(src|href)="(\/[\w-]+\.(?:js|css))"/g, (_match, attr: string, url: string) => {
    const relPath = url.slice(1);
    return `${attr}="${url}?v=${hashFile(relPath)}"`;
  });
}
