import { prisma } from "@app/db";
import { env } from "@app/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { DEFAULT_ROLE } from "./roles";

// Valori espliciti, non i default impliciti della libreria: in release i limiti
// anti-brute-force sono una decisione, non un accidente (Dev Notes "Hardening").
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

// Policy server-side: la versione Zod dei form è client-side e bypassabile
// chiamando /api/auth/sign-up/email direttamente (hardening, Story 1.4).
const MIN_PASSWORD_LENGTH = 8;

export function createAuth() {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      // Gate di verifica email: disattivata di DEFAULT (flag env, non
      // hard-coded — decisione di release di Alessandro, Story 1.6). Il
      // provider di invio è uno stub che logga su stdout: nessun provider
      // email nello Spine (dettaglio Deferred). Attivata ⇒ utenti con email
      // non verificata non autenticano.
      requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    },
    emailVerification: {
      // Provider stub (Story 1.6): il link di verifica va su stdout, nessun
      // provider email nello Spine. Il dettaglio del provider reale è
      // Deferred alla prima topologia che lo richiede.
      sendVerificationEmail: async ({ user, url }) => {
        console.log(
          `[email-verification stub] utente: ${user.email} — link di verifica: ${url}`,
        );
      },
    },
    rateLimit: {
      enabled: true,
      window: RATE_LIMIT_WINDOW_SECONDS,
      max: RATE_LIMIT_MAX_REQUESTS,
      customRules: {
        // /get-session è lettura ed è chiamata a ogni navigazione/tab
        // (authClient.useSession): nel bucket generico 10/60s con più tab o
        // utenti dietro NAT produrrebbe 429 su utenti legittimi.
        "/get-session": false,
      },
    },
    advanced: {
      ipAddress: {
        // CIDR dei proxy fidati dalla topologia di release (Story 1.6):
        // default [] = nessun proxy fidato. In release il compose dichiara la
        // subnet della rete interna (172.28.0.0/16 in docker-compose.release.yml)
        // e Better Auth stripperà la catena XFF da destra al primo hop non
        // fidato: l'XFF falsificato da un client esterno viene ignorato.
        trustedProxies: env.TRUSTED_PROXIES,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: DEFAULT_ROLE,
          // Il ruolo NON è assegnabile dal client di registro: nessun utente
          // nasce ADMIN/EDITOR (deny-by-default fin dall'ingresso). La
          // promozione è operazione amministrativa, fuori scope qui
          // (debito in deferred-work.md).
          input: false,
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [nextCookies()],
  });
}

export const auth = createAuth();

export { DEFAULT_ROLE, ROLES, parseRole, safeParseRole } from "./roles";
export type { Role } from "./roles";
