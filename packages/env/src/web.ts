import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { skipEnvValidation } from "./skip-validation";

/**
 * Env validato lato client. `NEXT_PUBLIC_SERVER_URL` è l'origin da cui il
 * browser parla con le API: serve a Better Auth client, che senza `baseURL`
 * funziona solo same-origin.
 */
export const env = createEnv({
  client: {
    NEXT_PUBLIC_SERVER_URL: z
      .url()
      .transform((value) => value.replace(/\/+$/, "")),
  },
  // Next sostituisce le NEXT_PUBLIC_* a build time solo se referenziate
  // letteralmente: `process.env` intero non basta.
  runtimeEnv: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  },
  skipValidation: skipEnvValidation,
  emptyStringAsUndefined: true,
});
