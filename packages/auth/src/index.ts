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
      // DECISIONE DOCUMENTATA (debito in deferred-work.md): la verifica email
      // resta disattivata per lo sviluppo — l'invio email richiederebbe un
      // provider non previsto dallo Spine. `requireEmailVerification` è un gate
      // di sicurezza reale: da attivare prima del deploy in release (Story 1.6).
      requireEmailVerification: false,
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
        // Topologia attuale: NESSUN reverse proxy — un XFF a valore singolo è
        // comunque controllabile dal client, quindi il limite per-IP resta
        // best-effort (spoofabile ruotando l'header). Quando l'envelope di
        // release (Story 1.6) introdurrà il proxy, impostare qui la CIDR del
        // proxy: Better Auth stripperà la catena da destra al primo hop non
        // fidato e l'XFF falsificato dal client verrà ignorato.
        trustedProxies: [],
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
