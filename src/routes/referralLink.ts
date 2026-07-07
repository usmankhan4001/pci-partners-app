import path from "node:path";
import { Router } from "express";
import { basicAuth } from "../middleware/basicAuth.js";

export const referralLinkRouter = Router();
const INTERNAL_DIR = path.join(process.cwd(), "internal");

referralLinkRouter.get("/internal/link-generator", basicAuth, (_req, res) => {
  res.sendFile(path.join(INTERNAL_DIR, "link-generator.html"));
});
