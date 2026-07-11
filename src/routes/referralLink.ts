import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { basicAuth } from "../middleware/basicAuth.js";
import { withAssetVersion } from "../utils/assetVersion.js";

export const referralLinkRouter = Router();
const INTERNAL_DIR = path.join(process.cwd(), "internal");
const linkGeneratorHtml = withAssetVersion(readFileSync(path.join(INTERNAL_DIR, "link-generator.html"), "utf8"));

referralLinkRouter.get("/internal/link-generator", basicAuth, (_req, res) => {
  res.type("html").send(linkGeneratorHtml);
});
