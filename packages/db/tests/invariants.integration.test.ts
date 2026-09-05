import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { afterAll, beforeAll, expect, it } from "vitest";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

const TEST_SLUG_PREFIX = "test-invariant-";
// Un DB freddo in CI (container appena partito) può superare il default di 5s.
const DB_TIMEOUT = 30_000;

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

// Stessa convenzione di prisma.config.ts: la variabile d'ambiente già esportata
// (CI, docker, shell) vince sul file `.env` di apps/web.
dotenv.config({
  path: path.resolve(packageRoot, "../../../apps/web/.env"),
  override: false,
});

// Guardia esplicita: questo test verifica un invariante del DB reale, non
// simulabile in-memory. Senza DATABASE_URL deve fallire, non saltare
// (nessun gate verde vacuo — stesso principio della Story 1.2).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL non impostata: il test di integrazione richiede un Postgres reale (pnpm db:start da packages/db).",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Pulizia preventiva: righe orfane di un run precedente killato prima del
// afterAll resterebbero nel DB (e complicherebbero run successivi).
// Stesso timeout dei test: un DB freddo vale anche per gli hook.
beforeAll(
  async () => {
    await prisma.page.deleteMany({ where: { slug: { startsWith: TEST_SLUG_PREFIX } } });
  },
  DB_TIMEOUT,
);

afterAll(
  async () => {
    // I test creano Page con slug prefissato; la cascade elimina le versioni.
    try {
      await prisma.page.deleteMany({ where: { slug: { startsWith: TEST_SLUG_PREFIX } } });
    } finally {
      await prisma.$disconnect();
    }
  },
  DB_TIMEOUT,
);

// AD-6: payload in forma Puck, schemaVersion persistito 1:1, nessuna normalizzazione.
function puckPayload(): object {
  return { schemaVersion: 1, content: [], root: {}, zones: {} };
}

// L'errore P2002 espone il vincolo violato a livello DB nel messaggio originale
// del driver (il nome dell'indice/constraint Postgres): serializzato, il test
// può pinare l'indice atteso senza dipendere dalla forma interna di Prisma.
function dbConstraintOf(error: unknown): string {
  const meta = (error as { meta?: unknown }).meta as
    | { driverAdapterError?: { cause?: { originalMessage?: string } } }
    | undefined;
  return meta?.driverAdapterError?.cause?.originalMessage ?? "";
}

async function createPageWithTwoDraftVersions(): Promise<{
  pageId: string;
  firstVersionId: string;
  secondVersionId: string;
}> {
  const slug = `${TEST_SLUG_PREFIX}${randomUUID()}`;
  const page = await prisma.page.create({
    data: {
      slug,
      title: "Test invariante pubblicazione",
      versions: {
        create: [
          { versionNumber: 1, payload: puckPayload() },
          { versionNumber: 2, payload: puckPayload() },
        ],
      },
    },
    include: { versions: true },
  });
  const [first, second] = [...page.versions].sort(
    (a, b) => a.versionNumber - b.versionNumber,
  );
  if (!first || !second) {
    throw new Error("Setup atteso fallito: meno di due PageVersion create.");
  }
  return { pageId: page.id, firstVersionId: first.id, secondVersionId: second.id };
}

it(
  "ha l'indice parziale page_version_published_unique con predicate sullo stato PUBLISHED (AD-7)",
  async () => {
    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'page_version_published_unique'
    `;
    const indexdef = indexes[0]?.indexdef;
    expect(
      indexdef,
      "l'indice parziale AD-7 deve esistere (creato nel SQL della migration)",
    ).toBeDefined();
    expect(indexdef).toContain("UNIQUE");
    expect(indexdef).toContain("WHERE");
    expect(indexdef).toContain("'PUBLISHED'");
  },
  DB_TIMEOUT,
);

it(
  "consente una PageVersion PUBLISHED per ciascuna di due Page diverse (l'indice è per-page, non globale)",
  async () => {
    const pageA = await createPageWithTwoDraftVersions();
    const pageB = await createPageWithTwoDraftVersions();

    // Entrambe le prime versioni diventano PUBLISHED: nessuna violazione attesa.
    await prisma.pageVersion.update({
      where: { id: pageA.firstVersionId },
      data: { status: "PUBLISHED" },
    });
    await prisma.pageVersion.update({
      where: { id: pageB.firstVersionId },
      data: { status: "PUBLISHED" },
    });

    const published = await prisma.pageVersion.findMany({
      // Scope ai pageId del test: un assert prefix-wide conterebbe anche le
      // fixture di un altro run condiviso sullo stesso DB.
      where: { pageId: { in: [pageA.pageId, pageB.pageId] }, status: "PUBLISHED" },
    });
    expect(published).toHaveLength(2);
  },
  DB_TIMEOUT,
);

it(
  "consente la rotazione: unpublish della versione PUBLISHED, poi publish della seconda (AD-7)",
  async () => {
    const { pageId, firstVersionId, secondVersionId } =
      await createPageWithTwoDraftVersions();

    await prisma.pageVersion.update({
      where: { id: firstVersionId },
      data: { status: "PUBLISHED" },
    });
    await prisma.pageVersion.update({
      where: { id: firstVersionId },
      data: { status: "DRAFT" },
    });
    // Senza conflitto: la prima non è più PUBLISHED, lo slot è libero.
    await prisma.pageVersion.update({
      where: { id: secondVersionId },
      data: { status: "PUBLISHED" },
    });

    const published = await prisma.pageVersion.findMany({
      where: { pageId, status: "PUBLISHED" },
    });
    expect(published).toHaveLength(1);
    expect(published[0]?.id).toBe(secondVersionId);
  },
  DB_TIMEOUT,
);

it(
  "serializza due publish concorrenti della stessa Page: esattamente uno vince (AD-7)",
  async () => {
    const { pageId, firstVersionId, secondVersionId } =
      await createPageWithTwoDraftVersions();

    const [win, lose] = await Promise.allSettled([
      prisma.pageVersion.update({
        where: { id: firstVersionId },
        data: { status: "PUBLISHED" },
      }),
      prisma.pageVersion.update({
        where: { id: secondVersionId },
        data: { status: "PUBLISHED" },
      }),
    ]);
    const outcomes = [win, lose].map((r) => r.status);
    expect(outcomes).toContain("fulfilled");
    expect(outcomes).toContain("rejected");

    const rejected = (win.status === "rejected" ? win : lose) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "P2002" });
    expect(dbConstraintOf(rejected.reason)).toContain("page_version_published_unique");

    const published = await prisma.pageVersion.findMany({
      where: { pageId, status: "PUBLISHED" },
    });
    expect(published).toHaveLength(1);
  },
  DB_TIMEOUT,
);

it(
  "rifiuta dal DB una seconda PageVersion PUBLISHED per la stessa Page (AD-7)",
  async () => {
    const { pageId, firstVersionId, secondVersionId } =
      await createPageWithTwoDraftVersions();

    await prisma.pageVersion.update({
      where: { id: firstVersionId },
      data: { status: "PUBLISHED" },
    });

    const rejection = await prisma.pageVersion
      .update({
        where: { id: secondVersionId },
        data: { status: "PUBLISHED" },
      })
      .catch((error: unknown) => error);

    expect(rejection).toMatchObject({ code: "P2002" });
    expect(dbConstraintOf(rejection)).toContain("page_version_published_unique");

    const published = await prisma.pageVersion.findMany({
      where: { pageId, status: "PUBLISHED" },
    });
    expect(published).toHaveLength(1);
    expect(published[0]?.id).toBe(firstVersionId);
  },
  DB_TIMEOUT,
);

it(
  "rifiuta dal DB un versionNumber duplicato per la stessa Page (AD-6)",
  async () => {
    const slug = `${TEST_SLUG_PREFIX}${randomUUID()}`;
    const page = await prisma.page.create({
      data: {
        slug,
        title: "Test versionNumber duplicato",
        versions: { create: { versionNumber: 1, payload: puckPayload() } },
      },
    });

    const rejection = await prisma.pageVersion
      .create({
        data: {
          pageId: page.id,
          versionNumber: 1,
          payload: puckPayload(),
        },
      })
      .catch((error: unknown) => error);

    expect(rejection).toMatchObject({ code: "P2002" });
    expect(dbConstraintOf(rejection)).toContain("page_version_pageId_versionNumber_key");
  },
  DB_TIMEOUT,
);
