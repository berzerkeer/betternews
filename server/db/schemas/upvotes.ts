import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";

import { userTable } from "~/db/schemas/auth.ts";
import { commentsTable } from "~/db/schemas/comments.ts";
import { postsTable } from "~/db/schemas/posts.ts";

export const postUpvotesTable = pgTable("post_upvotes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const postUpvotesRelations = relations(postUpvotesTable, ({ one }) => ({
  post: one(postsTable, {
    fields: [postUpvotesTable.postId],
    references: [postsTable.id],
    relationName: "postUpvotes",
  }),
  user: one(userTable, {
    fields: [postUpvotesTable.userId],
    references: [userTable.id],
    relationName: "user",
  }),
}));

export const commentUpvotesTable = pgTable("comment_upvotes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const commentUpvotesRelations = relations(
  commentUpvotesTable,
  ({ one }) => ({
    comment: one(commentsTable, {
      fields: [commentUpvotesTable.commentId],
      references: [commentsTable.id],
      relationName: "commentUpvotes",
    }),
    user: one(userTable, {
      fields: [commentUpvotesTable.userId],
      references: [userTable.id],
      relationName: "user",
    }),
  }),
);
