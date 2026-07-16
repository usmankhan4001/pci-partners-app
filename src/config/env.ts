import "dotenv/config";

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function flag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export const env = {
  port: Number(optional("PORT", "8080")),
  nodeEnv: optional("NODE_ENV", "development"),
  isProd: optional("NODE_ENV", "development") === "production",

  dbPath: optional("DB_PATH", "data/app.db"),
  uploadsDir: optional("UPLOADS_DIR", "data/uploads"),
  persistentStoragePath: optional("PERSISTENT_STORAGE_PATH", "data"),
  requirePersistentStorage: flag("REQUIRE_PERSISTENT_STORAGE", false),

  maxUploadMb: Number(optional("MAX_UPLOAD_MB", "5")),
  referralBaseUrl: optional("REFERRAL_BASE_URL", "http://localhost:8080"),
  tosVersion: optional("TOS_VERSION", "unversioned"),

  pdfTemplatePath: optional("PDF_TEMPLATE_PATH", "templates/SALES PARTNER REGISTRATION FORM (Digital).pdf"),

  internalUsers: optional("INTERNAL_USERS", ""),
  internalBasicAuthUser: optional("INTERNAL_BASIC_AUTH_USER", ""),
  internalBasicAuthPass: optional("INTERNAL_BASIC_AUTH_PASS", ""),
};
