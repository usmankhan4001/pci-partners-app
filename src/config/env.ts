import "dotenv/config";

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

const insforgeApiKey = process.env.INSFORGE_API_KEY || "";
if (!insforgeApiKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[env] INSFORGE_API_KEY is not set — form will render, but submissions will fail until it's configured.",
  );
}

export const env = {
  port: Number(optional("PORT", "8080")),
  nodeEnv: optional("NODE_ENV", "development"),
  isProd: optional("NODE_ENV", "development") === "production",

  insforgeApiBaseUrl: optional("INSFORGE_API_BASE_URL", "").replace(/\/?$/, ""),
  insforgeApiKey,
  insforgeTable: optional("INSFORGE_TABLE", "sales_partners"),
  insforgeBucket: optional("INSFORGE_BUCKET", "sales-partner-documents"),

  maxUploadMb: Number(optional("MAX_UPLOAD_MB", "5")),
  referralBaseUrl: optional("REFERRAL_BASE_URL", "http://localhost:8080"),
  tosVersion: optional("TOS_VERSION", "unversioned"),

  pdfTemplatePath: optional("PDF_TEMPLATE_PATH", "templates/SALES PARTNER REGISTRATION FORM (Digital).pdf"),

  internalBasicAuthUser: optional("INTERNAL_BASIC_AUTH_USER", ""),
  internalBasicAuthPass: optional("INTERNAL_BASIC_AUTH_PASS", ""),
};
