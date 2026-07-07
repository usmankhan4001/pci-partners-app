import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Gates /internal/* pages (e.g. the rep referral-link generator) behind HTTP Basic Auth. */
export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  if (!env.internalBasicAuthUser || !env.internalBasicAuthPass) {
    res.status(503).send("Internal pages are not configured (INTERNAL_BASIC_AUTH_* missing).");
    return;
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    if (safeEqual(user, env.internalBasicAuthUser) && safeEqual(pass, env.internalBasicAuthPass)) {
      next();
      return;
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="PCI Internal"');
  res.status(401).send("Authentication required.");
}
