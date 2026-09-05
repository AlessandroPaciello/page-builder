import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { skipEnvValidation } from "./skip-validation";

/**
 * Gli URL di origine non devono mai avere lo slash finale: `trustedOrigins` di
 * Better Auth confronta l'origin per uguaglianza stringa (e rifiuterebbe un
 * origin legittimo), e la concatenazione `${BETTER_AUTH_URL}/api/rpc` lato SSR
 * produrrebbe un doppio slash. Normalizziamo qui, una volta, invece di
 * ricordarcene a ogni call site.
 */
const originUrl = z
  .url()
  .transform((value) => value.replace(/\/+$/, ""));

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: originUrl,
    CORS_ORIGIN: originUrl,
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: skipEnvValidation,
  emptyStringAsUndefined: true,
});
