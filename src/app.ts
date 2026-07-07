import path from "node:path";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { formRouter } from "./routes/form.js";
import { repsRouter } from "./routes/reps.js";
import { submitRouter } from "./routes/submit.js";
import { referralLinkRouter } from "./routes/referralLink.js";
import { healthRouter } from "./routes/health.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "script-src": ["'self'"],
          "img-src": ["'self'", "data:"],
        },
      },
    }),
  );

  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));

  const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/submissions", submitLimiter);

  app.use(healthRouter);
  app.use(repsRouter);
  app.use(submitRouter);
  app.use(referralLinkRouter);
  app.use(formRouter);

  app.use(express.static(path.join(process.cwd(), "public")));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("Unhandled request error", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(400).json({ error: message });
  });

  return app;
}
