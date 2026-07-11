import path from "node:path";
import { Router } from "express";
import { basicAuth } from "../middleware/basicAuth.js";
import { listSalesPartners } from "../db/salesPartnerStore.js";

export const adminRouter = Router();
const INTERNAL_DIR = path.join(process.cwd(), "internal");

adminRouter.get("/internal/admin", basicAuth, (_req, res) => {
  res.sendFile(path.join(INTERNAL_DIR, "admin.html"));
});

adminRouter.get("/internal/api/submissions", basicAuth, (_req, res) => {
  res.json(listSalesPartners());
});
