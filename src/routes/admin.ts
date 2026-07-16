import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { listSalesPartners, listSalesPartnersByRepresentative } from "../db/salesPartnerStore.js";
import { basicAuth, requireInternalRole } from "../middleware/basicAuth.js";
import { withAssetVersion } from "../utils/assetVersion.js";

export const adminRouter = Router();
const INTERNAL_DIR = path.join(process.cwd(), "internal");
const adminHtml = withAssetVersion(readFileSync(path.join(INTERNAL_DIR, "admin.html"), "utf8"));

adminRouter.get("/internal/admin", basicAuth, requireInternalRole("admin", "rep"), (_req, res) => {
  res.type("html").send(adminHtml);
});

adminRouter.get("/internal/api/me", basicAuth, requireInternalRole("admin", "rep"), (req, res) => {
  const user = req.internalUser!;
  res.json({ username: user.username, displayName: user.display_name, role: user.role });
});

adminRouter.get("/internal/api/submissions", basicAuth, requireInternalRole("admin", "rep"), (req, res) => {
  const user = req.internalUser!;
  res.json(user.role === "admin" ? listSalesPartners() : listSalesPartnersByRepresentative(user.display_name));
});
