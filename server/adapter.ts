import { drizzle } from "drizzle-orm/postgres-js";

import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { sessionTable, userRelations, userTable } from "~/db/schemas/auth.ts";
import { commentRelations, commentsTable } from "~/db/schemas/comments.ts";
import { postRelations, postsTable } from "~/db/schemas/posts.ts";
import {
  commentUpvotesRelations,
  commentUpvotesTable,
  postUpvotesRelations,
  postUpvotesTable,
} from "~/db/schemas/upvotes.ts";
import postgres from "postgres";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const processEnv = EnvSchema.parse(process.env);

const queryClient = postgres(processEnv.DATABASE_URL, { debug: true });
export const db = drizzle(queryClient, {
  schema: {
    user: userTable,
    session: sessionTable,
    posts: postsTable,
    comments: commentsTable,
    postUpvotes: postUpvotesTable,
    commentUpvoted: commentUpvotesTable,
    postRelations,
    commentUpvotesRelations,
    postUpvotesRelations,
    userRelations,
    commentRelations,
  },
});

export const adapter = new DrizzlePostgreSQLAdapter(
  db,
  sessionTable,
  userTable,
);
