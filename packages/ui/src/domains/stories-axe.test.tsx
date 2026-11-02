/// <reference types="vite/client" />
import { cleanup, render } from "@testing-library/react";
import { composeStories } from "@storybook/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

/**
 * Story 2.29, decisione 3: axe bloccante su ogni story `@generated` di
 * `domains/`. È il controllo automatico che il giudizio in Storybook non può
 * dare — le violazioni axe di una cella si vedono in CI, non a occhio — e sta
 * in GA accanto al tema nel CSS, al contrasto e ai font.
 *
 * Le story si scoprono per glob (nessun elenco a mano), come lo smoke delle
 * story: qui però contano solo quelle con il marker `@generated` di pds, che
 * scrive `generate_component`. Le story scritte a mano restano allo smoke.
 */

/** La prima riga dei file `@generated` di pds (`// @generated pds <versione> sha256:<hex> — non modificare a mano`). */
const GENERATED_HEADER = /^\/\/ @generated pds \S+ sha256:[0-9a-f]{64} — non modificare a mano$/;

// Glob letterale (Vite non accetta una costante) e speculare a `domains/` in apps/storybook/.storybook/main.ts.
const modules = import.meta.glob("./**/*.stories.tsx", { eager: true }) as Record<string, Record<string, unknown>>;
const sources = import.meta.glob("./**/*.stories.tsx", { eager: true, query: "?raw", import: "default" }) as Record<
  string,
  string
>;

/** La prima riga di un modulo: il marker `@generated`, se c'è. */
function firstLine(source: string | undefined): string {
  return (source ?? "").split("\n")[0] ?? "";
}

const generated = Object.keys(modules)
  .filter((path) => GENERATED_HEADER.test(firstLine(sources[path])))
  .sort();

/** Le violazioni axe di un albero renderizzato, con il contesto del chiamante. */
async function violationsOf(element: HTMLElement, where: string) {
  const results = await axe(element);
  return results.violations.map((violation) => `${where}: ${violation.id} — ${violation.help}`);
}

afterEach(() => {
  cleanup();
});

describe("axe sulle story @generated di domains/ (Story 2.29)", () => {
  it("scopre le story per glob e ne riconosce almeno una @generated", () => {
    expect(generated.length).toBeGreaterThan(0);
    expect(generated.every((path) => path.endsWith(".stories.tsx"))).toBe(true);
  });

  for (const path of generated) {
    const mod = modules[path]!;

    describe(path, () => {
      it("ogni story @generated non ha violazioni axe", async () => {
        const composed = composeStories(mod as Parameters<typeof composeStories>[0]) as Record<string, ComponentType>;
        const storyNames = Object.keys(composed);
        expect(storyNames.length).toBeGreaterThan(0);
        for (const storyName of storyNames) {
          const Story = composed[storyName] as ComponentType;
          // La story è un componente, non una pagina: il `main` dà il landmark che
          // la regola axe `region` chiede (stesso uso di editor/dropdown-menu.test.tsx).
          render(
            <main>
              <Story />
            </main>,
          );
          expect(await violationsOf(document.body, `${path} › ${storyName}`)).toEqual([]);
          cleanup();
        }
      });
    });
  }

  it("rosso: un pulsante senza nome accessibile fa fallire il gate", async () => {
    const { container } = render(
      <main>
        <button type="button" />
      </main>,
    );
    const violations = await violationsOf(container, "prova");
    expect(violations.some((violation) => violation.includes("button-name"))).toBe(true);
  });

  it("verde: lo stesso albero con un nome accessibile passa", async () => {
    const { container } = render(
      <main>
        <button type="button">Salva</button>
      </main>,
    );
    expect(await violationsOf(container, "prova")).toEqual([]);
  });
});
