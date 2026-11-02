import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .default("mongodb://127.0.0.1:27017"),
  MONGODB_DB: z
    .string()
    .min(1)
    .default("bikinprd"),
  AI_BASE_URL: z.string().optional().default("http://127.0.0.1:20128/v1"),
  AI_API_KEY: z.string().optional().default("sk-035aa783d373c298-t4mmyi-35d0e9a7"),
  AI_MODEL: z.string().optional().default("ag/gemini-3.8-flash-high"),
  AI_TIMEOUT_MS: z.coerce.number().optional().default(45000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("Server environment variables cannot be accessed on the client side.");
  }

  if (!cachedEnv) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("Invalid server environment configuration:", parsed.error.format());
      throw new Error(`Environment validation failed: ${parsed.error.message}`);
    }
    cachedEnv = parsed.data;
  }

  return cachedEnv;
}

export const env = {
  get MONGODB_URI() {
    return getServerEnv().MONGODB_URI;
  },
  get MONGODB_DB() {
    return getServerEnv().MONGODB_DB;
  },
};
