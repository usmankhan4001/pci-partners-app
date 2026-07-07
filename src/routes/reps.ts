import { Router } from "express";
import { listReps } from "../reps/repsConfig.js";

export const repsRouter = Router();

repsRouter.get("/api/reps", async (_req, res) => {
  const reps = await listReps();
  res.json({ reps });
});
