import multer from "multer";
import { env } from "../config/env.js";
import { ALLOWED_DOC_MIME_TYPES } from "../validation/salesPartnerSchema.js";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
    files: 4, // cnic, incorp, ntn, address — the signature arrives as a data URL field, not a file
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_DOC_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type for ${file.fieldname}: ${file.mimetype}. Use PDF, JPG, or PNG.`));
      return;
    }
    cb(null, true);
  },
});
