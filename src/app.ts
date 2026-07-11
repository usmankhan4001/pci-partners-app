import path from "node:path";
import express from "express";
import helmet from "helmet";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { UploadValidationError } from "./middleware/upload.js";
import { formRouter } from "./routes/form.js";
import { submitRouter } from "./routes/submit.js";
import { referralLinkRouter } from "./routes/referralLink.js";
import { adminRouter } from "./routes/admin.js";
import { healthRouter } from "./routes/health.js";
import { logger } from "./utils/logger.js";
import { env } from "./config/env.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Cloudflare auto-injects its RUM beacon into HTML responses for
          // proxied domains — this isn't something the app opted into, but
          // blocking it just spams the console, so allow it explicitly.
          "script-src": ["'self'", "https://static.cloudflareinsights.com"],
          "img-src": ["'self'", "data:"],
          // The confirmation screen embeds the generated PDF (served from
          // our own /uploads route) in an <iframe> for preview — frame-src
          // has no default, so it falls back to default-src 'self', which
          // already covers this, but keep it explicit for clarity.
          "frame-src": ["'self'"],
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
  app.use(submitRouter);
  app.use(referralLinkRouter);
  app.use(adminRouter);
  app.use(formRouter);

  // path.resolve (not path.join) so this still works if UPLOADS_DIR is
  // configured as an absolute path — path.join would otherwise mangle it
  // by prefixing process.cwd() onto an already-absolute path.
  app.use("/uploads", express.static(path.resolve(process.cwd(), env.uploadsDir)));
  app.use(express.static(path.join(process.cwd(), "public")));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      const messages: Partial<Record<string, string>> = {
        LIMIT_FILE_SIZE: `File is too large (max ${env.maxUploadMb}MB).`,
        LIMIT_FILE_COUNT: "Too many files uploaded.",
        LIMIT_UNEXPECTED_FILE: "Unexpected file field.",
      };
      res.status(400).json({ error: messages[err.code] || "There was a problem with your uploaded file." });
      return;
    }
    if (err instanceof UploadValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    // Anything else reaching here is unexpected — don't leak internal error
    // text (library wording, file paths, stack details) to the client.
    logger.error("Unhandled request error", err);
    res.status(400).json({ error: "Something went wrong processing your request." });
  });

  return app;
}
