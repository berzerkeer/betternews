import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import type { Context } from "~/context.ts";
import { lucia } from "~/lucia.ts";
import { authRouter } from "~/routes/auth.ts";
import { postsRouter } from "~/routes/posts.ts";

import type { ErrorResponse } from "~/shared/types.ts";

const app = new Hono<Context>();

// Attach user and session to all route context, so that these can be accessed via context in other routes
app.use("*", cors(), async (c, next) => {
  const sessionId = lucia.readSessionCookie(c.req.header("Cookie") ?? "");
  if (!sessionId) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (session && session.fresh) {
    c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), {
      append: true,
    });
  }
  if (!session) {
    c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize(), {
      append: true,
    });
  }
  c.set("session", session);
  c.set("user", user);
  return next();
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routes = app
  .basePath("/api")
  .route("/auth", authRouter)
  .route("/posts", postsRouter);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return (
      err.res ??
      c.json<ErrorResponse>(
        {
          error: err.message,
          success: false,
          isFormError:
            err.cause && typeof err.cause === "object" && "form" in err.cause
              ? err.cause.form === true
              : false,
        },
        err.status,
      )
    );
  }
  return c.json<ErrorResponse>(
    {
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : (err.stack ?? err.message),
    },
    500,
  );
});

export default app;
export type ApiRoutes = typeof routes;
