import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { withAssetVersion } from "../utils/assetVersion.js";

export const formRouter = Router();
const PUBLIC_DIR = path.join(process.cwd(), "public");
const indexHtml = withAssetVersion(readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8"));

formRouter.get(["/", "/register"], (_req, res) => {
  res.type("html").send(indexHtml);
});
