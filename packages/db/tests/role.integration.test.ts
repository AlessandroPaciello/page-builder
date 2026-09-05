import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { afterAll, beforeAll, expect, it } from "vitest";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

const TEST_EMAIL_PREFIX = "test-role-";
// Un DB freddo in CI (container appena partito) può superare il default di 5s.
const DB_TIMEOUT = 30_000;

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

// Stessa convenzione di prisma.config.ts e degli altri test di integrazione:
// la variabile d'ambiente già esportata (CI, docker, shell) vince sul file
// `.env` di apps/web.
dotenv.config({
  path: path.resolve(packageRoot, "../../../apps/web/.env"),
  override: false,
});

// Guardia esplicita: questo test verifica il default di colonna su Postgres
// reale, non simulabile in-memory. Senza DATABASE_URL deve fallire, non saltare
// (nessun gate verde vacuo — pattern Story 1.3).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL non impostata: il test di integrazione richiede un Postgres reale (pnpm db:start da packages/db).",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

beforeAll(
  async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    });
  },
  DB_TIMEOUT,
);

afterAll(
  async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: { startsWith: TEST_EMAIL_PREFIX } },
      });
    } finally {
      await prisma.$disconnect();
    }
  },
  DB_TIMEOUT,
);

it(
  "applica il default di colonna CLIENTE a un nuovo utente senza role (AC#1)",
  async () => {
    const user = await prisma.user.create({
      data: {
        // L'id è senza default nello schema: è Better Auth a generarlo. Nel
        // test DB lo forniamo esplicitamente.
        id: randomUUID(),
        name: "Test Role",
        email: `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`,
      },
    });

    expect(user.role).toBe("CLIENTE");
  },
  DB_TIMEOUT,
);

it(
  "il default di colonna è esattamente il minor privilegio della tassonomia: CLIENTE (AD-4)",
  async () => {
    // Il DB non ha un CHECK sulla tassonomia (colonna stringa per design):
    // la difesa è la normalizzazione fail-fast alla lettura (packages/auth,
    // test dedicato). Qui pinniamo il valore esatto del default: il minor
    // privilegio della matrice RBAC, non solo "non ADMIN/non EDITOR".
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: "Test Role Default",
        email: `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`,
      },
      select: { role: true },
    });

    expect(user.role).toBe("CLIENTE");
  },
  DB_TIMEOUT,
);
