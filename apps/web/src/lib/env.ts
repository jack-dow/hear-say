import { z } from "zod";

const schema = z.object({
  VITE_CONVEX_URL: z.string().min(1),
  VITE_API_URL: z.string().min(1),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((e) => `  ${e.path.join(".")}: ${e.message}`)
    .join("\n");
  throw new Error(`❌ Invalid environment variables:\n${errors}`);
}

export const env = parsed.data;
