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
