/// <reference types="vite/client" />
import { cleanup, render } from "@testing-library/react";
import { composeStories } from "@storybook/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

/**
 * Smoke delle story generate (Story 2.11): scopre le story per glob — nessun
 * elenco hard-coded di componenti o story — asserisce che ogni story
 * dichiara `args` (CSF3: le props stanno in `args`, mai al primo livello) e
 * rende ogni story via `composeStories`. Una story senza `args` è un test
 * rosso che nomina componente e story; le altre story girano comunque (un
 * `describe` per modulo). Vale invariato per le story di `render` v2: la
 * forma attesa è sempre CSF3 con `args`.
 */

const modules = import.meta.glob("./domains/**/*.stories.tsx", { eager: true }) as Record<
  string,
  Record<string, unknown> & { default?: { title?: string; component?: { displayName?: string; name?: string } } }
>;
// Glob speculare a apps/storybook/.storybook/main.ts (runtime diversi, nessuna costante condivisa).
// Parità verificata da apps/storybook/.storybook/main.test.ts: se i due glob divergono, quella suite è rossa.

function hasArgs(story: unknown): boolean {
  if (story === null || typeof story !== "object" || !("args" in story)) return false;
  const args = (story as { args?: unknown }).args;
  return typeof args === "object" && args !== null && !Array.isArray(args);
}

function componentNameOf(path: string, mod: (typeof modules)[string]): string {
  const fromMeta = mod.default?.component?.displayName ?? mod.default?.component?.name;
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.stories\.tsx$/, "");
}

describe("stories smoke — ogni story CSF3 con args e rende via composeStories", () => {
  it("scopre le story per glob (nessun elenco hard-coded)", () => {
    expect(Object.keys(modules).length).toBeGreaterThan(0);
  });

  it("red-proof: la vecchia forma (props al primo livello, senza args) non passa il gate", () => {
    const oldForm = { label: "Etichetta", variant: "default" };
    expect(hasArgs(oldForm)).toBe(false);
    expect(hasArgs({ args: null })).toBe(false);
    expect(hasArgs({ args: [] })).toBe(false);
    expect(hasArgs({ args: {} })).toBe(true);
  });

  for (const [path, mod] of Object.entries(modules).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const componentName = componentNameOf(path, mod);
    const storyNames = Object.keys(mod)
      .filter((key) => key !== "default" && key !== "__esModule")
      .sort();

    describe(`${componentName} (${path})`, () => {
      it("ogni story dichiara `args` (CSF3)", () => {
        expect(storyNames.length).toBeGreaterThan(0);
        for (const storyName of storyNames) {
          expect(
            hasArgs(mod[storyName]),
            `${componentName} — story "${storyName}" senza \`args\`: le props devono stare in \`args\` (CSF3), non al primo livello.`,
          ).toBe(true);
        }
      });

      it("ogni story rende via composeStories", () => {
        const composed = composeStories(mod as Parameters<typeof composeStories>[0]) as Record<string, ComponentType>;
        expect(Object.keys(composed).length).toBeGreaterThan(0);
        for (const [storyName, Story] of Object.entries(composed)) {
          const StoryComponent = Story as ComponentType;
          let unmount: (() => void) | undefined;
          try {
            expect(
              () => {
                ({ unmount } = render(<StoryComponent />));
              },
              `${componentName} — story "${storyName}" non rende via composeStories.`,
            ).not.toThrow();
          } finally {
            unmount?.();
            cleanup();
          }
        }
      });
    });
  }
});
