type Level = "info" | "warn" | "error";

function log(level: Level, msg: string, meta?: unknown) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta !== undefined) fn(line, meta);
  else fn(line);
}

export const logger = {
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
};
