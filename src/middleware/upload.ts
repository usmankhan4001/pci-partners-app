import multer from "multer";
import { env } from "../config/env.js";
import { ALLOWED_DOC_MIME_TYPES } from "../validation/salesPartnerSchema.js";

// Thrown for deliberately user-facing upload problems (as opposed to
// multer.MulterError for size/count limits, or a genuinely unexpected
// error) — the top-level error handler in app.ts shows this message as-is
// rather than a generic fallback.
export class UploadValidationError extends Error {}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
    files: 4, // cnic, incorp, ntn, address — the signature arrives as a data URL field, not a file
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_DOC_MIME_TYPES.includes(file.mimetype)) {
      cb(new UploadValidationError(`Unsupported file type for ${file.fieldname}: ${file.mimetype}. Use PDF, JPG, or PNG.`));
      return;
    }
    cb(null, true);
  },
});
