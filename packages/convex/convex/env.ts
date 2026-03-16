import { z } from "zod";

function requireEnv<T extends z.ZodObject<z.ZodRawShape>>(schema: T): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`❌ Invalid environment variables:\n${errors}`);
  }
  return parsed.data;
}

export const env = requireEnv(
  z.object({
    INTERNAL_SECRET: z.string(),
    JWT_PRIVATE_KEY: z.string(),
    JWKS: z.string(),
  }),
);
