import type { Env } from "hono";

import type { Session, User } from "lucia";

export interface Context extends Env {
  Variables: {
    user: User | null; // User can be null when there is no session
    session: Session | null; // Session can be null too, when there are no valid users
  };
}
