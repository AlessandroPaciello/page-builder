import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it } from "vitest";

import { prisma } from "@app/db";
import { auth } from "../src/index";

const TEST_EMAIL_PREFIX = "test-auth-role-";

let ipCounter = 0;

function uniqueTestIp(): string {
  // IP valido e univoco per richiesta, generato in modo deterministico a
  // contatore (nessuna collisione → nessun 429 spurious tra i test): le
  // special rules di Better Auth (max 3 /sign-up ogni 10s per IP, hardening
  // di questa story) altrimenti bloccano i sign-up ripetuti del test stesso.
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

function signUpRequest(
  body: Record<string, unknown>,
  ip: string = uniqueTestIp(),
): Request {
  return new Request("http://localhost:3000/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // IP univoco per richiesta: il rateLimit esplicito (10 richieste/60s,
      // hardening di questa story) altrimenti blocca i sign-up ripetuti del
      // test stesso dalla stessa origine — ed è proprio quello che deve fare.
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

function cookiesOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

beforeAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
});

afterAll(async () => {
  try {
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    });
  } finally {
    await prisma.$disconnect();
  }
});

it(
  "sign-up senza role produce un utente CLIENTE in DB e in sessione (AC#1)",
  async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`;
    const response = await auth.handler(
      signUpRequest({ name: "Cliente Base", email, password: "password-sicura-1" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      user: { id: string; role?: string };
    };
    expect(body.user.role).toBe("CLIENTE");

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.role).toBe("CLIENTE");
  },
);

it(
  "sign-up con tentativo di iniezione role=ADMIN non è onorato: deny-by-default sull'ingresso (AC#2)",
  async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`;
    const response = await auth.handler(
      signUpRequest({
        name: "Attore Malevole",
        email,
        password: "password-sicura-1",
        role: "ADMIN",
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      user: { id: string; role?: string };
    };
    // L'input del client NON arriva al ruolo: resta il default minor privilegio.
    expect(body.user.role).not.toBe("ADMIN");
    expect(body.user.role).toBe("CLIENTE");

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.role).toBe("CLIENTE");
  },
);

it(
  "sign-up con password sotto la minima server-side è rifiutato (hardening, non solo policy Zod dei form)",
  async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`;
    const response = await auth.handler(
      signUpRequest({ name: "Poco Sicuro", email, password: "corta1" }),
    );

    expect(response.status).toBe(400);
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).toBeNull();
  },
);

it(
  "getSession senza cookie di sessione è respinta: null, mai una sessione (AC#2, guard deny-by-default)",
  async () => {
    const session = await auth.api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  },
);

it(
  "getSession con cookie di sessione valida restituisce l'utente con il ruolo (AC#1)",
  async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`;
    const response = await auth.handler(
      signUpRequest({ name: "Con Sessione", email, password: "password-sicura-1" }),
    );
    expect(response.status).toBe(200);

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookiesOf(response) }),
    });
    expect(session?.user.email).toBe(email);
    expect(session?.user.role).toBe("CLIENTE");
  },
);

it(
  "getSession con cookie di sessione invalida (token non esistente) è respinta: null, mai 200",
  async () => {
    const session = await auth.api.getSession({
      headers: new Headers({
        cookie: "better-auth.session_token=token-inventato-che-non-esiste",
      }),
    });
    expect(session).toBeNull();
  },
);

it(
  "il rate limit è attivo: lo stesso IP supera le special rules di /sign-up (3/10s) e riceve 429",
  async () => {
    // Tutte le richieste dallo STESSO IP: le special rules native di Better
    // Auth consentono 3 /sign-up per finestra di 10s per IP — la quarta deve
    // essere bloccata (questo è l'anti-brute-force dell'hardening, qui
    // verificato davvero, non solo aggirato).
    const fixedIp = uniqueTestIp();
    const results: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`;
      const response = await auth.handler(
        signUpRequest(
          { name: "Rate Limited", email, password: "password-sicura-1" },
          fixedIp,
        ),
      );
      results.push(response.status);
    }

    expect(results.slice(0, 3)).toEqual([200, 200, 200]);
    expect(results[3]).toBe(429);
  },
);
