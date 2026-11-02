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

import { DOMAINS_DIR, generateComponent, type Change } from "@penpot-ds/scripts/src/core";
import { badgeLettura, CONTRACTS } from "@penpot-ds/scripts/tests/fixtures/components";
import { carouselLettura, SECTION_INPUT } from "@penpot-ds/scripts/tests/fixtures/sections";

/**
 * Il controllo della Story 2.22 fatto in modo permanente (Story 2.31): il
 * generatore produce Badge e la sezione Carousel in una cartella temporanea
 * dentro `packages/ui/tmp/`, e l'output viene compilato con `tsc` e passato
 * allo smoke delle story (`stories.smoke.test.tsx`).
 *
 * La cartella sta sotto `packages/ui` perché i generati importano
 * `../../lib/utils` e i pacchetti bare (`react`, `class-variance-authority`,
 * `@storybook/react`): solo qui la risoluzione è quella vera. Gli stub
 * (`lib/utils.ts`, `domains/product-card/ProductCard.tsx`) coprono ciò che il
 * generatore dà per esistente: `ProductCard` arriva con la 2.41. Il test non
 * scrive sotto `src/` e rimuove la cartella in `finally`.
 */

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const TMP_DIR = join(packageRoot, "tmp");

const STUB_UTILS = `/** Stub di \`lib/utils\`: i generati importano \`cn\` da qui. */
export function cn(...inputs: unknown[]): string {
  return inputs.filter(Boolean).join(" ");
}
`;

const STUB_PRODUCT_CARD = `/**
 * Stub di \`domains/product-card/ProductCard\`: le story della sezione Carousel
 * lo importano per i figli di default. Il componente vero arriva con la 2.41.
 */
export interface ProductCardProps {
  readonly image?: string;
  readonly price?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly href?: string;
  readonly badgeLabel?: string;
}

export function ProductCard(_props: ProductCardProps) {
  return null;
}
`;

/** Il tsconfig dei generati: la risoluzione è quella di `packages/ui`, i file sono solo quelli della prova. */
const TSCONFIG = `${JSON.stringify(
  {
    extends: "../../tsconfig.json",
    compilerOptions: { noEmit: true },
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
  mkdirSync(join(root, "domains", "product-card"), { recursive: true });
  writeFileSync(join(root, "lib", "utils.ts"), STUB_UTILS);
  writeFileSync(join(root, "domains", "product-card", "ProductCard.tsx"), STUB_PRODUCT_CARD);
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

/** Una cartella temporanea nuova dentro `packages/ui/tmp/`, rimossa dal chiamante. */
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
