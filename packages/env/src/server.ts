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
    /**
     * CIDR/IP fidati come proxy davanti all'app (Better Auth risolve l'IP
     * client reale stripperando XFF da destra al primo hop non fidato).
     * Lista separata da virgole; default [] = NESSUN proxy fidato (topologia
     * senza reverse proxy, la postura di dev). In release il compose imposta
     * la subnet della rete interna dichiarata in docker-compose.release.yml.
     */
    TRUSTED_PROXIES: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((cidr) => cidr.trim())
          .filter(Boolean),
      ),
    /**
     * Gate di verifica email: default FALSE (decisione documentata — l'invio
     * email richiederebbe un provider non previsto dallo Spine). Se attivata,
     * Better Auth non autentica utenti con email non verificata e la
     * callback sendVerificationEmail (stub su stdout in packages/auth) emette
     * il link di verifica. La decisione di attivarla al rilascio è di
     * Alessandro: flag env, mai hard-coded.
     */
    REQUIRE_EMAIL_VERIFICATION: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: skipEnvValidation,
  emptyStringAsUndefined: true,
});
