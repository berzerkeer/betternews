import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, asc, countDistinct, desc, eq, sql } from "drizzle-orm";

import { zValidator } from "@hono/zod-validator";
import { db } from "~/adapter.ts";
import type { Context } from "~/context.ts";
import { userTable } from "~/db/schemas/auth.ts";
import { postsTable } from "~/db/schemas/posts.ts";
import { postUpvotesTable } from "~/db/schemas/upvotes.ts";
import { loggedIn } from "~/middleware/loggedIn.ts";
import postgres from "postgres";

import {
  createPostSchema,
  paginationSchema,
  type PaginatedResponse,
  type Post,
  type SuccessResponse,
} from "~/shared/types.ts";
import { getISOFormatDateQuery } from "~/lib/utils.ts";

export const postsRouter = new Hono<Context>()
  .post("/", loggedIn, zValidator("form", createPostSchema), async (c) => {
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
  })
  .get("/", zValidator("query", paginationSchema), async (c) => {
    const { limit, page, site, author, order, sortBy } = c.req.valid("query");
    const user = c.get("user");

    const offset = (page - 1) * limit;

    const sortByColumn =
      sortBy === "points" ? postsTable.points : postsTable.createdAt;
    const sortOrder = order === "desc" ? desc(sortByColumn) : asc(sortByColumn);

    const [count] = await db
      .select({ count: countDistinct(postsTable.id) })
      .from(postsTable)
      .where(
        and(
          author ? eq(postsTable.userId, author) : undefined,
          site ? eq(postsTable.url, site) : undefined,
        ),
      );

    const postsQuery = db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        url: postsTable.url,
        points: postsTable.points,
        content: postsTable.content,
        createdAt: getISOFormatDateQuery(postsTable.createdAt),
        commentCount: postsTable.commentCount,
        author: {
          username: userTable.username,
          id: userTable.id,
        },
        isUpvoted: user
          ? sql<boolean>`CASE WHEN ${postUpvotesTable.userId} IS NOT NULL THEN true ELSE false END`
          : sql<boolean>`${false}`,
      })
      .from(postsTable)
      .leftJoin(userTable, eq(postsTable.userId, userTable.id))
      .orderBy(sortOrder)
      .limit(limit)
      .offset(offset)
      .where(
        and(
          author ? eq(postsTable.userId, author) : undefined,
          site ? eq(postsTable.url, site) : undefined,
        ),
      );

    if (user) {
      postsQuery.leftJoin(
        postUpvotesTable,
        and(
          eq(postUpvotesTable.postId, postsTable.id),
          eq(postUpvotesTable.userId, user.id),
        ),
      );
    }

    const posts = await postsQuery;

    return c.json<PaginatedResponse<Post[]>>(
      {
        data: posts as Post[],
        success: true,
        message: "Posts fetched",
        pagination: {
          page,
          totalPages: Math.ceil(count.count / limit),
        },
      },
      200,
    );
  });
