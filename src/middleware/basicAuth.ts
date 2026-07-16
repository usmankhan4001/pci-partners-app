import type { NextFunction, Request, Response } from "express";
import { authenticateInternalUser, hasInternalUsersConfigured, type InternalUserRole } from "../db/internalUserStore.js";

function challenge(res: Response, status = 401, message = "Authentication required."): void {
  res.set("WWW-Authenticate", 'Basic realm="PCI Internal"');
  res.status(status).send(message);
}

export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  if (!hasInternalUsersConfigured()) {
    res.status(503).send("Internal pages are not configured (set INTERNAL_USERS or INTERNAL_BASIC_AUTH_*).");
    return;
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    const authenticatedUser = authenticateInternalUser(user, pass);
    if (authenticatedUser) {
      req.internalUser = authenticatedUser;
      next();
      return;
    }
  }

  challenge(res);
}

export function requireInternalRole(...roles: InternalUserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.internalUser;
    if (!user) {
      challenge(res);
      return;
    }
    if (!roles.includes(user.role)) {
      challenge(res, 403, "You do not have access to this resource.");
      return;
    }
    next();
  };
}
