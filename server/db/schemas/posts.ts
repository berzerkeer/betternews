import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";

import { userTable } from "~/db/schemas/auth.ts";
import { commentsTable } from "~/db/schemas/comments.ts";
import { postUpvotesTable } from "~/db/schemas/upvotes.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  content: text("content"),
  points: integer("points").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const insertPostSchema = createInsertSchema(postsTable, {
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  url: z
    .string()
    .trim()
    .url({ message: "URL must be a valid URL" })
    .optional()
    .or(z.literal("")),
  content: z.string().optional(),
});

export const postRelations = relations(postsTable, ({ one, many }) => ({
  author: one(userTable, {
    fields: [postsTable.userId],
    references: [userTable.id],
    relationName: "author",
  }),
  postUpvotes: many(postUpvotesTable, {
    relationName: "postUpvotes",
  }),
  comments: many(commentsTable),
}));
