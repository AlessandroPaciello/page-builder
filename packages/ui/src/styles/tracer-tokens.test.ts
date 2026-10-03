// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";

/**
 * Review epic-1 (P3): `--color-tracer-primary` vive in
 * `tailwind-extras.css` hand-owned (tracciante 1.4, live `tracer.primary
 * #0E5A3C`). Nessun test leggeva extras: cancellarla o storpiarla restava
 * verde. Compila `globals.css` e prova che `bg-tracer-primary` produce CSS
 * con il valore live (stesso harness di `generated-classes.test.ts`).
 */

const stylesDir = dirname(fileURLToPath(import.meta.url));
const globalsCss = readFileSync(join(stylesDir, "globals.css"), "utf8");

describe("tracciante 1.4 → CSS (review epic-1)", () => {
  it("bg-tracer-primary produce CSS con il valore live #0E5A3C", async () => {
    const compiler = await compile(globalsCss, { base: stylesDir, onDependency: () => {} });
    const output = compiler.build(["bg-tracer-primary"]).toLowerCase();
    expect(output).toContain("bg-tracer-primary");
    expect(output).toContain("#0e5a3c");
  }, 60_000);

  it("rosso: una utility fantasma non produce CSS (sensibilità del harness)", async () => {
    const compiler = await compile(globalsCss, { base: stylesDir, onDependency: () => {} });
    const empty = compiler.build([]);
    expect(compiler.build(["bg-tracer-primary-fantasma"])).toBe(empty);
  }, 60_000);
});
