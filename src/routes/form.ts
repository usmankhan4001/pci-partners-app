import path from "node:path";
import { Router } from "express";

export const formRouter = Router();
const PUBLIC_DIR = path.join(process.cwd(), "public");

formRouter.get(["/", "/register"], (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});
