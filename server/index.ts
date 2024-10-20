import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { ErrorResponse } from "~/shared/types.ts";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

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
