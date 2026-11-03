// @vitest-environment jsdom
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { execPath } from "node:process";
import { fileURLToPath } from "node:url";

import { composeStories } from "@storybook/react";
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

import { DOMAINS_DIR, generateComponent, type Change } from "../src/core";
import { badgeLettura, CONTRACTS } from "./fixtures/components";
import { carouselLettura, SECTION_INPUT } from "./fixtures/sections";

/**
 * Il controllo della Story 2.22 fatto in modo permanente (Story 2.31): il
 * generatore produce Badge e la sezione Carousel in una cartella temporanea
 * dentro `packages/scripts/tmp/`, e l'output viene compilato con `tsc` e
 * passato alle stesse asserzioni dello smoke delle story
 * (`packages/ui/src/stories.smoke.test.tsx`).
 *
 * La cartella sta dentro questo package — non in `packages/ui` — perché il
 * generatore è suo: `@penpot-ds/scripts` non deve entrare nelle dipendenze di
 * `@penpot-ds/ui`, che è un package dell'app (lo porterebbe nel grafo di
 * `turbo run build --filter=web`, e con lui `@app/contracts`).
 *
 * Gli stub (`lib/utils.ts`, `domains/shop-card/ShopCard.tsx`) coprono ciò che il
 * generatore dà per esistente: la cartella della prova non contiene i componenti
 * scritti a mano, e le story della sezione Carousel importano il figlio di
 * default `ShopCard`. Il test non scrive sotto `src/` e rimuove la cartella in
 * `finally`.
 */

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const TMP_DIR = join(packageRoot, "tmp");

const STUB_UTILS = `/** Stub di \`lib/utils\`: i generati importano \`cn\` da qui. */
export function cn(...inputs: unknown[]): string {
  return inputs.filter(Boolean).join(" ");
}
`;

const STUB_SHOP_CARD = `/**
 * Stub di \`domains/shop-card/ShopCard\`: le story della sezione Carousel lo
 * importano per i figli di default. La cartella della prova non ha i componenti
 * scritti a mano, quindi le props che la story passa devono esistere qui.
 */
export interface ShopCardProps {
  readonly href?: string;
  readonly image?: string;
  readonly imageAlt?: string;
  readonly category?: string;
  readonly heading?: string;
  readonly description?: string;
  readonly price?: string;
  readonly badgeLabel?: string;
  readonly ctaLabel?: string;
}

export function ShopCard(_props: ShopCardProps) {
  return null;
}
`;

/** Il tsconfig dei generati: la risoluzione è quella del package, i file sono solo quelli della prova. */
const TSCONFIG = `${JSON.stringify(
  {
    extends: "../../tsconfig.json",
    compilerOptions: { noEmit: true, jsx: "react-jsx", lib: ["ESNext", "DOM", "DOM.Iterable"] },
    include: ["domains/**/*.ts", "domains/**/*.tsx", "lib/**/*.ts"],
  },
  null,
  2,
)}\n`;

type StoryModule = Record<string, unknown>;

/** Lo stesso predicato dello smoke: CSF3 vuole `args` oggetto, non le props al primo livello. */
function hasArgs(story: unknown): boolean {
  if (story === null || typeof story !== "object" || !("args" in story)) return false;
  const args = (story as { args?: unknown }).args;
  return typeof args === "object" && args !== null && !Array.isArray(args);
}

/** Un `Change` del generatore, scritto sotto la root temporanea (il path è quello vero, relativo al repo). */
function writeChange(root: string, change: Change): void {
  if (change.action === "elimina") return;
  expect(change.path.startsWith(`${DOMAINS_DIR}/`), `${change.path}: fuori dalla cartella dei componenti`).toBe(true);
  const target = join(root, "domains", change.path.slice(DOMAINS_DIR.length + 1));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, change.content);
}

/** Genera Badge e Carousel nella root data, con gli stub e il tsconfig; restituisce i path delle story. */
function generateInto(root: string): string[] {
  mkdirSync(join(root, "lib"), { recursive: true });
  mkdirSync(join(root, "domains", "shop-card"), { recursive: true });
  writeFileSync(join(root, "lib", "utils.ts"), STUB_UTILS);
  writeFileSync(join(root, "domains", "shop-card", "ShopCard.tsx"), STUB_SHOP_CARD);
  writeFileSync(join(root, "tsconfig.json"), TSCONFIG);

  const input = { ...SECTION_INPUT, contracts: CONTRACTS, generated: [] as string[] };
  for (const lettura of [badgeLettura(), carouselLettura()]) {
    const result = generateComponent(lettura, input);
    expect(result.findings, `il generatore si ferma su "${lettura.component}"`).toEqual([]);
    expect(result.changes.length).toBeGreaterThan(0);
    for (const change of result.changes) writeChange(root, change);
  }
  return [join(root, "domains", "badge", "Badge.stories.tsx"), join(root, "domains", "carousel", "Carousel.stories.tsx")];
}

/** `tsc --noEmit` sul tsconfig della prova: `status` 0 solo se ogni generato compila. */
function typeCheck(root: string): { status: number | null; output: string } {
  const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
  const result = spawnSync(execPath, [tsc, "--noEmit", "-p", join(root, "tsconfig.json")], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/** Le asserzioni dello smoke delle story, ripetute sui moduli generati. */
async function expectStoriesRender(storiesPath: string): Promise<void> {
  const mod = (await import(storiesPath)) as StoryModule;
  const storyNames = Object.keys(mod)
    .filter((key) => key !== "default" && key !== "__esModule")
    .sort();
  expect(storyNames.length, `${storiesPath}: nessuna story`).toBeGreaterThan(0);
  for (const storyName of storyNames) {
    expect(hasArgs(mod[storyName]), `${storiesPath} — story "${storyName}" senza \`args\` (CSF3).`).toBe(true);
  }

  const composed = composeStories(mod as Parameters<typeof composeStories>[0]) as Record<string, ComponentType>;
  expect(Object.keys(composed).length).toBeGreaterThan(0);
  for (const [storyName, Story] of Object.entries(composed)) {
    const StoryComponent = Story as ComponentType;
    let unmount: (() => void) | undefined;
    try {
      expect(() => {
        ({ unmount } = render(<StoryComponent />));
      }, `${storiesPath} — story "${storyName}" non rende via composeStories.`).not.toThrow();
    } finally {
      unmount?.();
      cleanup();
    }
  }
}

/** Una cartella temporanea nuova dentro `packages/scripts/tmp/`, rimossa dal chiamante. */
function tempRoot(): string {
  mkdirSync(TMP_DIR, { recursive: true });
  return mkdtempSync(join(TMP_DIR, "generated-"));
}

describe("output del generatore: compila e le story rendono", () => {
  it("Badge e Carousel generati: tsc --noEmit esce 0 e ogni story dichiara `args` e rende", async () => {
    const root = tempRoot();
    try {
      const stories = generateInto(root);
      const checked = typeCheck(root);
      expect(checked.status, `tsc non compila i generati:\n${checked.output}`).toBe(0);
      for (const storiesPath of stories) await expectStoriesRender(storiesPath);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  it("red-proof: uno `styles.ts` mutato non compila (il gate non è verde per caso)", () => {
    const root = tempRoot();
    try {
      generateInto(root);
      const styles = join(root, "domains", "badge", "Badge.styles.ts");
      writeFileSync(styles, `${readFileSync(styles, "utf8")}\nconst mutato: number = "non un numero";\n`);
      const checked = typeCheck(root);
      expect(checked.status).not.toBe(0);
      expect(checked.output).toContain("Badge.styles.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
