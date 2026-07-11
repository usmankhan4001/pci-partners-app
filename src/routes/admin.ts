import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { basicAuth } from "../middleware/basicAuth.js";
import { listSalesPartners } from "../db/salesPartnerStore.js";
import { withAssetVersion } from "../utils/assetVersion.js";

export const adminRouter = Router();
const INTERNAL_DIR = path.join(process.cwd(), "internal");
const adminHtml = withAssetVersion(readFileSync(path.join(INTERNAL_DIR, "admin.html"), "utf8"));

adminRouter.get("/internal/admin", basicAuth, (_req, res) => {
  res.type("html").send(adminHtml);
});

adminRouter.get("/internal/api/submissions", basicAuth, (_req, res) => {
  res.json(listSalesPartners());
});
