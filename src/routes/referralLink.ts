import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { env } from "../config/env.js";
import { basicAuth, requireInternalRole } from "../middleware/basicAuth.js";
import { withAssetVersion } from "../utils/assetVersion.js";

export const referralLinkRouter = Router();
const INTERNAL_DIR = path.join(process.cwd(), "internal");
const linkGeneratorHtml = withAssetVersion(readFileSync(path.join(INTERNAL_DIR, "link-generator.html"), "utf8"));

referralLinkRouter.get("/internal/link-generator", basicAuth, requireInternalRole("admin", "rep"), (_req, res) => {
  res.type("html").send(linkGeneratorHtml);
});

referralLinkRouter.post("/internal/api/referral-links", basicAuth, requireInternalRole("admin", "rep"), (req, res) => {
  const user = req.internalUser!;
  const requestedRepName = String(req.body?.repName || "").trim();
  const repName = user.role === "admin" ? requestedRepName : user.display_name;
  if (!repName) {
    res.status(400).json({ error: "Representative name is required." });
    return;
  }

  const baseUrl = env.referralBaseUrl.replace(/\/$/, "");
  res.json({ repName, url: `${baseUrl}/register?rep=${encodeURIComponent(repName)}` });
});
