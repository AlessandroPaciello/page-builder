import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { componentPaths, Finding, generateComponent, Lettura, withGeneratedHeader, type Change, type GenerateResult } from "../../src/core";
import { createPdsServer, type PdsServerOptions, type PenpotAdapter } from "../../src/server/server";
import { TOOL_NAMES } from "../../src/server/tools";
import type { ThemeCatalog } from "../../src/shared/theme-generator";
import { badgeLettura, CONTRACTS, layer, SCALE, shopCardLettura } from "../fixtures/components";

/**
 * Livello 2 della CI (Story 2.24): il server `pds` in memoria
 * (`InMemoryTransport`) con un adattatore Penpot finto costruito dalle
 * `Lettura` di `tests/fixtures/components.ts`. `generate_component` scrive in
 * una root temporanea.
 */

/** Il catalogo dei token usati dalle fixture; la spaziatura dà la stessa scala di `SCALE`. */
const CATALOG: ThemeCatalog = {
  themes: [],
  sets: [
    {
      name: "test",
      tokens: [
        ...["primary", "primary-foreground", "secondary", "destructive", "accent", "muted"].map((name) => ({ name, type: "color" as const, value: "#112233" })),
        ...SCALE.map((step) => ({ name: `spacing.${step.suffix}`, type: "spacing" as const, value: String(step.px) })),
        { name: "text.xs", type: "fontSizes" as const, value: "12" },
        { name: "text.sm", type: "fontSizes" as const, value: "14" },
      ],
    },
  ],
};

const LETTURE: Readonly<Record<string, () => Lettura>> = {
  badge: () => badgeLettura(),
  "shop-card": () => shopCardLettura(),
};

function adapter(overrides: Partial<PenpotAdapter> = {}): PenpotAdapter {
  return {
    readComponent: async (name) => {
      const make = LETTURE[name];
      if (make === undefined) throw new Error(`Nessun componente "${name}" in Penpot.`);
      return make();
    },
    readTokenCatalog: async () => structuredClone(CATALOG),
    ...overrides,
  };
}

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "pds-server-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function connect(options: Partial<PdsServerOptions> = {}): Promise<{ client: Client; root: string }> {
  const root = options.root ?? tempRoot();
  const server = createPdsServer({ penpot: adapter(), contracts: CONTRACTS, ...options, root });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, root };
}

interface ToolResult {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: { type: string; text?: string }[];
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

const textOf = (result: ToolResult): string => result.content.map((item) => item.text ?? "").join("\n");

/** Tutti i file sotto `root` (path relativi a barre, in ordine) con il contenuto. */
function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(join(dir, entry.name), rel);
      else out[rel] = readFileSync(join(dir, entry.name), "utf8");
    }
  };
  if (existsSync(root)) walk(root, "");
  return out;
}

function put(root: string, path: string, content: string): void {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), content);
}

const BADGE = componentPaths("badge");
const SHOP_CARD = componentPaths("shop-card");

describe("tools/list", () => {
  it("espone i sei strumenti", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
  });
});

describe("describe_component", () => {
  it("restituisce la Lettura dell'adattatore, valida per lo schema", async () => {
    const { client } = await connect();
    const result = await call(client, "describe_component", { name: "badge" });
    expect(result.isError).toBeFalsy();
    expect(Lettura.parse(result.structuredContent)).toEqual(badgeLettura());
  });

  it("ingresso invalido ({name: 3}) → isError di validazione", async () => {
    const { client } = await connect();
    const result = await call(client, "describe_component", { name: 3 });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Input validation error/);
  });

  it("l'adattatore fallisce → isError col messaggio, il server resta vivo", async () => {
    const { client } = await connect({
      penpot: adapter({
        readComponent: async () => {
          throw new Error("Penpot non risponde (timeout)");
        },
      }),
    });
    const result = await call(client, "describe_component", { name: "badge" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Penpot non risponde (timeout)");
    // Una seconda chiamata risponde ancora: nessun crash.
    expect((await client.listTools()).tools).toHaveLength(TOOL_NAMES.length);
  });
});

describe("verify_component", () => {
  it("Badge pulito: nessun blocco né domanda (senza TSX lo scaffold non chiede niente)", async () => {
    const { client } = await connect();
    const result = await call(client, "verify_component", { name: "badge" });
    expect(result.isError).toBeFalsy();
    const findings = Finding.array().parse(result.structuredContent!.findings);
    expect(findings.filter((finding) => finding.level !== "avviso")).toEqual([]);
  });

  it("legge il TSX dal disco: una parte che il TSX non usa dà l'avviso di export inutilizzato", async () => {
    const { client, root } = await connect();
    put(root, BADGE.tsx, "export function Badge() { return null; }\n");
    const result = await call(client, "verify_component", { name: "badge" });
    const findings = Finding.array().parse(result.structuredContent!.findings);
    expect(findings.some((finding) => finding.level === "avviso" && finding.message.includes("label"))).toBe(true);
  });

  it("layer senza part → la domanda del nucleo, così com'è", async () => {
    const { client } = await connect({
      penpot: adapter({ readComponent: async () => badgeLettura(() => [layer({ name: "Testo", kind: "text" })]) }),
    });
    const result = await call(client, "verify_component", { name: "badge" });
    const findings = Finding.array().parse(result.structuredContent!.findings);
    expect(findings.some((finding) => finding.level === "domanda" && finding.key === "part")).toBe(true);
  });

  it("ingresso invalido (senza name) → isError", async () => {
    const { client } = await connect();
    const result = await call(client, "verify_component", {});
    expect(result.isError).toBe(true);
  });
});

describe("build_order", () => {
  it("ShopCard⊃Badge, nessuno generato → badge prima di shop-card", async () => {
    const { client } = await connect();
    const result = await call(client, "build_order", { names: ["shop-card", "badge"] });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ order: ["badge", "shop-card"], findings: [] });
  });

  it("i generati vengono dal disco: Badge con styles.ts @generated basta a ShopCard da sola", async () => {
    const { client, root } = await connect();
    expect((await call(client, "build_order", { names: ["shop-card"] })).structuredContent!.order).toEqual([]);
    put(root, BADGE.styles, withGeneratedHeader("export {};\n"));
    expect((await call(client, "build_order", { names: ["shop-card"] })).structuredContent).toEqual({ order: ["shop-card"], findings: [] });
  });

  it("uno styles.ts senza marker non conta come generato", async () => {
    const { client, root } = await connect();
    put(root, BADGE.styles, "export {};\n");
    const result = await call(client, "build_order", { names: ["shop-card"] });
    expect(result.structuredContent!.order).toEqual([]);
    expect(Finding.array().parse(result.structuredContent!.findings)[0]!.level).toBe("blocco");
  });

  it("ingresso invalido (names vuoto) → isError", async () => {
    const { client } = await connect();
    expect((await call(client, "build_order", { names: [] })).isError).toBe(true);
  });
});

describe("generate_component", () => {
  it("Badge pulito, root vuota → written = styles, stories, tsx nella cartella del componente", async () => {
    const { client, root } = await connect();
    const result = await call(client, "generate_component", { name: "badge" });
    expect(result.isError, textOf(result)).toBeFalsy();
    const { written, changes } = result.structuredContent as { written: string[]; changes: Change[] };
    expect(written).toEqual([BADGE.styles, BADGE.stories, BADGE.tsx]);
    for (const change of changes) {
      if (change.action === "elimina") continue;
      expect(readFileSync(join(root, change.path), "utf8")).toBe(change.content);
    }
    expect(Object.keys(snapshot(root)).sort()).toEqual([BADGE.stories, BADGE.styles, BADGE.tsx].sort());
  });

  it("TSX esistente modificato: resta identico byte per byte e nessun Change lo tocca", async () => {
    const { client, root } = await connect();
    await call(client, "generate_component", { name: "badge" });
    const mine = `${readFileSync(join(root, BADGE.tsx), "utf8")}// mio\r\n`;
    writeFileSync(join(root, BADGE.tsx), mine);
    const result = await call(client, "generate_component", { name: "badge" });
    expect(result.isError, textOf(result)).toBeFalsy();
    const { changes, written } = result.structuredContent as { changes: Change[]; written: string[] };
    expect(changes.filter((change) => change.path === BADGE.tsx)).toEqual([]);
    expect(written).toEqual([]);
    expect(readFileSync(join(root, BADGE.tsx), "utf8")).toBe(mine);
  });

  it("domanda aperta (layer senza part) → findings con la domanda, written: [], disco invariato", async () => {
    const { client, root } = await connect({
      penpot: adapter({ readComponent: async () => badgeLettura(() => [layer({ name: "Testo", kind: "text" })]) }),
    });
    put(root, "README.md", "x\n");
    const before = snapshot(root);
    const result = await call(client, "generate_component", { name: "badge" });
    expect(result.isError).toBeFalsy();
    const { findings, written, changes } = result.structuredContent as { findings: Finding[]; written: string[]; changes: Change[] };
    expect(findings.some((finding) => finding.level === "domanda")).toBe(true);
    expect(written).toEqual([]);
    expect(changes).toEqual([]);
    expect(snapshot(root)).toEqual(before);
  });

  it("annidato non generato: ShopCard senza badge/Badge.styles.ts → blocco, niente scritto", async () => {
    const { client, root } = await connect();
    const result = await call(client, "generate_component", { name: "shop-card" });
    expect(result.isError).toBeFalsy();
    const { findings, written } = result.structuredContent as { findings: Finding[]; written: string[] };
    expect(findings.some((finding) => finding.level === "blocco" && finding.message.includes("badge"))).toBe(true);
    expect(written).toEqual([]);
    expect(snapshot(root)).toEqual({});
  });

  it("ShopCard dopo Badge (nell'ordine di build_order) → scritta nella sua cartella", async () => {
    const { client, root } = await connect();
    await call(client, "generate_component", { name: "badge" });
    const result = await call(client, "generate_component", { name: "shop-card" });
    expect(result.isError, textOf(result)).toBeFalsy();
    expect((result.structuredContent as { written: string[] }).written).toEqual([SHOP_CARD.styles, SHOP_CARD.stories, SHOP_CARD.tsx]);
    expect(existsSync(join(root, SHOP_CARD.styles))).toBe(true);
  });

  /** Un nucleo finto che restituisce i `changes` dati, senza esiti. */
  const fakeCore =
    (changes: Change[]) =>
    (): GenerateResult => ({ changes, findings: [], suggestions: [] });

  it.each([
    ["con ..", `${BADGE.styles.replace("badge/Badge.styles.ts", "badge/../x.ts")}`],
    ["fuori cartella", "../x"],
    ["assoluto", "/tmp/pds-x.ts"],
    ["in un altro componente", SHOP_CARD.styles],
  ])("path %s → isError, niente scritto (neanche i Change validi)", async (_label, path) => {
    const root = tempRoot();
    const { client } = await connect({
      root,
      generate: fakeCore([
        { action: "crea", path: BADGE.styles, content: "ok\n" },
        { action: "crea", path, content: "fuori\n" },
      ]),
    });
    const result = await call(client, "generate_component", { name: "badge" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(path);
    expect(snapshot(root)).toEqual({});
  });

  it("crea su un file che esiste → isError, niente scritto", async () => {
    const { client, root } = await connect({ generate: fakeCore([{ action: "crea", path: BADGE.tsx, content: "nuovo\n" }]) });
    put(root, BADGE.tsx, "mio\n");
    const result = await call(client, "generate_component", { name: "badge" });
    expect(result.isError).toBe(true);
    expect(readFileSync(join(root, BADGE.tsx), "utf8")).toBe("mio\n");
  });

  it("elimina e aggiorna toccano solo un file con marker", async () => {
    const { client, root } = await connect({ generate: fakeCore([{ action: "elimina", path: BADGE.tsx }]) });
    put(root, BADGE.tsx, "mio\n");
    expect((await call(client, "generate_component", { name: "badge" })).isError).toBe(true);
    expect(readFileSync(join(root, BADGE.tsx), "utf8")).toBe("mio\n");

    const second = await connect({ root, generate: fakeCore([{ action: "aggiorna", path: BADGE.tsx, content: "sovrascritto\n" }]) });
    expect((await call(second.client, "generate_component", { name: "badge" })).isError).toBe(true);
    expect(readFileSync(join(root, BADGE.tsx), "utf8")).toBe("mio\n");

    put(root, BADGE.stories, withGeneratedHeader("vecchio\n"));
    const third = await connect({ root, generate: fakeCore([{ action: "elimina", path: BADGE.stories }]) });
    const result = await call(third.client, "generate_component", { name: "badge" });
    expect(result.isError, textOf(result)).toBeFalsy();
    expect(existsSync(join(root, BADGE.stories))).toBe(false);
  });

  it("aggiorna su un file con marker e contenuto vecchio → scritto, path in written", async () => {
    const fresh = withGeneratedHeader("nuovo\n");
    const { client, root } = await connect({ generate: fakeCore([{ action: "aggiorna", path: BADGE.styles, content: fresh }]) });
    put(root, BADGE.styles, withGeneratedHeader("vecchio\n"));
    const result = await call(client, "generate_component", { name: "badge" });
    expect(result.isError, textOf(result)).toBeFalsy();
    expect((result.structuredContent as { written: string[] }).written).toEqual([BADGE.styles]);
    expect(readFileSync(join(root, BADGE.styles), "utf8")).toBe(fresh);
  });

  it("due crea sullo stesso file → isError, disco vuoto", async () => {
    const { client, root } = await connect({
      generate: fakeCore([
        { action: "crea", path: BADGE.styles, content: "a\n" },
        { action: "crea", path: BADGE.styles, content: "b\n" },
      ]),
    });
    expect((await call(client, "generate_component", { name: "badge" })).isError).toBe(true);
    expect(snapshot(root)).toEqual({});
  });

  it.each([
    ["aggiorna", { action: "aggiorna", path: BADGE.styles, content: "x\n" }],
    ["elimina", { action: "elimina", path: BADGE.styles }],
  ] as const)("%s su un file che non esiste → isError", async (_label, change) => {
    const { client, root } = await connect({ generate: fakeCore([change]) });
    const result = await call(client, "generate_component", { name: "badge" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("non esiste");
    expect(snapshot(root)).toEqual({});
  });

  it("con un blocco del nucleo non si scrive niente, anche se ci sono changes", async () => {
    const { client, root } = await connect({
      generate: () => ({ changes: [{ action: "crea", path: BADGE.styles, content: "x\n" }], findings: [{ level: "blocco", where: "x", message: "no" }], suggestions: [] }),
    });
    const result = await call(client, "generate_component", { name: "badge" });
    expect((result.structuredContent as { written: string[] }).written).toEqual([]);
    expect(snapshot(root)).toEqual({});
  });

  it("il generatore vero è il default", async () => {
    const { client, root } = await connect({ generate: generateComponent });
    expect((await call(client, "generate_component", { name: "badge" })).isError).toBeFalsy();
    expect(existsSync(join(root, BADGE.styles))).toBe(true);
  });

  it("ingresso invalido ({name: 3}) → isError, niente scritto", async () => {
    const { client, root } = await connect();
    const result = await call(client, "generate_component", { name: 3 });
    expect(result.isError).toBe(true);
    expect(snapshot(root)).toEqual({});
  });

  it("il catalogo token non si legge → isError col messaggio", async () => {
    const { client } = await connect({
      penpot: adapter({
        readTokenCatalog: async () => {
          throw new Error("catalogo irraggiungibile");
        },
      }),
    });
    const result = await call(client, "generate_component", { name: "badge" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("catalogo irraggiungibile");
  });
});

describe("tokens_from_css ed extract_theme (Story 2.26)", () => {
  const SEED = `@theme {
  --color-primary: var(--color-neutral-900);
  --color-ring: var(--color-neutral-400);
}
[data-brand="ocean"] {
  --color-primary: var(--color-blue-600);
}
`;

  it("tokens_from_css sul seme: set, temi e avvisi, senza toccare il disco", async () => {
    const { client, root } = await connect();
    const result = await call(client, "tokens_from_css", { css: SEED });
    expect(result.isError, textOf(result)).toBeFalsy();
    const { sets, themes, warnings } = result.structuredContent as {
      sets: { name: string }[];
      themes: { group: string; name: string }[];
      warnings: { var: string; why: string }[];
    };
    expect(sets.map((set) => set.name)).toEqual(["tailwind", "semantic", "brand/ocean"]);
    expect(themes).toEqual([
      { group: "brand", name: "default", sets: [] },
      { group: "brand", name: "ocean", sets: ["brand/ocean"] },
    ]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(snapshot(root)).toEqual({});
  });

  it("tokens_from_css senza css → isError di validazione", async () => {
    const { client } = await connect();
    const result = await call(client, "tokens_from_css", {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Input validation error/);
  });

  it("extract_theme scrive theme.css, tokens.generated.ts e fonts.css e restituisce i pacchetti", async () => {
    const { client, root } = await connect();
    const result = await call(client, "extract_theme", {});
    expect(result.isError, textOf(result)).toBeFalsy();
    const { written, packages } = result.structuredContent as { written: string[]; packages: string[] };
    expect(written).toEqual(["packages/tokens/src/theme.css", "packages/tokens/src/tokens.generated.ts", "packages/tokens/src/fonts.css"]);
    expect(existsSync(join(root, "packages/tokens/src/theme.css"))).toBe(true);
    expect(readFileSync(join(root, "packages/tokens/src/theme.css"), "utf8")).toContain("@generated pds");
    expect(packages).toEqual([]);
  });

  it("extract_theme non sovrascrive un file del tema senza marker", async () => {
    const { client, root } = await connect();
    put(root, "packages/tokens/src/theme.css", "mio\n");
    const result = await call(client, "extract_theme", {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("senza il marker @generated");
    expect(readFileSync(join(root, "packages/tokens/src/theme.css"), "utf8")).toBe("mio\n");
  });

  it("extract_theme con fonts non valido → isError di validazione", async () => {
    const { client } = await connect();
    const result = await call(client, "extract_theme", { fonts: "woff2" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Input validation error/);
  });

  it("extract_theme con un argomento estraneo → isError di validazione", async () => {
    const { client } = await connect();
    const result = await call(client, "extract_theme", { root: 3 });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Input validation error/);
  });

  it("extract_theme sull'uscita di tokens_from_css servita dall'adattatore finto: theme.css dalla base, brand-ocean.css con le tre variabili (AC 2)", async () => {
    const seed = readFileSync(new URL("../fixtures/seed-theme.css", import.meta.url), "utf8");
    const { client: first } = await connect();
    const tokens = (await call(first, "tokens_from_css", { css: seed })).structuredContent as unknown as ThemeCatalog;
    const { client, root } = await connect({ penpot: adapter({ readTokenCatalog: async () => ({ sets: tokens.sets, themes: tokens.themes }) }) });
    const result = await call(client, "extract_theme", {});
    expect(result.isError, textOf(result)).toBeFalsy();
    const theme = readFileSync(join(root, "packages/tokens/src/theme.css"), "utf8");
    expect(theme).toContain("--color-primary: var(--color-neutral-900);");
    const ocean = readFileSync(join(root, "packages/tokens/src/themes/brand-ocean.css"), "utf8");
    expect([...ocean.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1])).toEqual(["--color-primary", "--color-primary-foreground", "--color-ring"]);
  });

  it("extract_theme legge anche i set che nessun tema attiva (set non attivi)", async () => {
    const catalog: ThemeCatalog = {
      themes: [{ group: "mode", name: "light", sets: ["attivo"] }],
      sets: [
        { name: "attivo", tokens: [{ name: "color.primary", type: "color", value: "#111111" }] },
        { name: "inattivo", tokens: [{ name: "color.extra", type: "color", value: "#222222" }] },
      ],
    };
    const { client, root } = await connect({ penpot: adapter({ readTokenCatalog: async () => catalog }) });
    const result = await call(client, "extract_theme", {});
    expect(result.isError, textOf(result)).toBeFalsy();
    expect(readFileSync(join(root, "packages/tokens/src/theme.css"), "utf8")).toContain("--color-extra: #222222;");
  });

  it("extract_theme con una collisione vera nella base → isError che nomina i due token, nessun file scritto", async () => {
    const catalog: ThemeCatalog = {
      themes: [],
      sets: [
        { name: "a", tokens: [{ name: "color.dup", type: "color", value: "#111111" }] },
        { name: "b", tokens: [{ name: "dup", type: "color", value: "#222222" }] },
      ],
    };
    const { client, root } = await connect({ penpot: adapter({ readTokenCatalog: async () => catalog }) });
    const result = await call(client, "extract_theme", {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('"color.dup"');
    expect(textOf(result)).toContain('"dup"');
    expect(snapshot(root)).toEqual({});
  });

  it("extract_theme: il catalogo token non si legge → isError col messaggio", async () => {
    const { client } = await connect({
      penpot: adapter({
        readTokenCatalog: async () => {
          throw new Error("catalogo irraggiungibile");
        },
      }),
    });
    const result = await call(client, "extract_theme", {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("catalogo irraggiungibile");
  });
});
