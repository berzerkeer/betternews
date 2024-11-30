import { insertPostSchema } from "~/db/schemas/posts.ts";
import { z } from "zod";

export type SuccessResponse<T = void> = {
  success: true;
  message: string;
} & (T extends void ? object : { data: T });

export type ErrorResponse = {
  success: false;
  error: string;
  isFormError?: boolean;
};

export const loginSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(31)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(3).max(255),
});

export const createPostSchema = insertPostSchema
  .pick({
    url: true,
    title: true,
    content: true,
  })
  .refine((data) => data.url || data.content, {
    message: "URL or Content must be provided",
    path: ["url", "content"],
  });

export const sortBySchema = z.enum(["recent", "points"]);
export const orderBySchema = z.enum(["asc", "desc"]);

export const paginationSchema = z.object({
  limit: z.number({ coerce: true }).default(10),
  page: z.number({ coerce: true }).default(1),
  sortBy: sortBySchema.optional().default("points"),
  order: orderBySchema.optional().default("asc"),
  author: z.string().optional(),
  site: z.string().optional(),
});

export type Author = {
  id: string;
  username: string;
};

export type Post = {
  id: number;
  title: string;
  url: string | null;
  points: number;
  createdAt: string;
  content: string | null;
  commentCount: number;
  author: Author;
  isUpvoted: boolean;
};

export type PaginatedResponse<T = void> = {
  pagination: {
    page: number;
    totalPages: number;
  };
  data: T;
} & Omit<SuccessResponse, "data">;
