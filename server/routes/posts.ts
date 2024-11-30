import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { zValidator } from "@hono/zod-validator";
import { db } from "~/adapter.ts";
import type { Context } from "~/context.ts";
import { postsTable } from "~/db/schemas/posts.ts";
import { loggedIn } from "~/middleware/loggedIn.ts";
import postgres from "postgres";

import { createPostSchema, type SuccessResponse } from "~/shared/types.ts";

export const postsRouter = new Hono<Context>().post(
  "/",
  loggedIn,
  zValidator("form", createPostSchema),
  async (c) => {
    const { title, url, content } = c.req.valid("form");
    const user = c.get("user")!;
    try {
      const [post] = await db
        .insert(postsTable)
        .values({
          title,
          url,
          content,
          userId: user.id,
        })
        .returning({ id: postsTable.id });
      return c.json<SuccessResponse<{ postId: number }>>(
        {
          success: true,
          message: "Post created",
          data: {
            postId: post.id,
          },
        },
        201,
      );
    } catch (error) {
      if (error instanceof postgres.PostgresError) {
        throw new HTTPException(500, { message: "Failed to create post" });
      }
    }
  },
);
