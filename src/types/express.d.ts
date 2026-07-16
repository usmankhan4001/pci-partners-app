import type { AuthenticatedInternalUser } from "../db/internalUserStore.js";

declare global {
  namespace Express {
    interface Request {
      internalUser?: AuthenticatedInternalUser;
    }
  }
}

export {};
