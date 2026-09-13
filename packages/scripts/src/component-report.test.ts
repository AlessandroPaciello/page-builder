import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VerdictCollector,
  exitCodeOf,
  publishReport,
  renderMarkdown,
  renderTerminal,
  statusOf,
  type ComponentReport,
} from "./component-report";

function report(overrides: Partial<ComponentReport> = {}): ComponentReport {
  return { title: "gates:render", components: [], global: [], notes: [], ...overrides };
}

describe("statusOf / VerdictCollector", () => {
  it("rosso vince su in attesa, in attesa su ok; un componente dichiarato senza problemi è ok", () => {
    expect(statusOf([])).toBe("ok");
    expect(statusOf([{ severity: "pending", message: "p" }])).toBe("pending");
    expect(statusOf([{ severity: "pending", message: "p" }, { severity: "red", message: "r" }])).toBe("red");

    const collector = new VerdictCollector();
    collector.declare("Badge");
    collector.pending("Input", "variante info non adottata");
    collector.red("AccordionItem", "artefatto rotto");
    expect(collector.verdicts().map((v) => [v.component, v.status])).toEqual([
      ["Badge", "ok"],
      ["Input", "pending"],
      ["AccordionItem", "red"],
    ]);
  });
});

describe("exitCodeOf — decisione 1", () => {
  it("0 con voci ok e in attesa, 1 con almeno una voce rossa (anche globale)", () => {
    const pending = report({
      components: [
        { component: "Badge", status: "ok", problems: [] },
        { component: "Input", status: "pending", problems: [{ severity: "pending", message: "adopt" }] },
      ],
    });
    expect(exitCodeOf(pending)).toBe(0);
    expect(exitCodeOf(report({ components: [{ component: "Badge", status: "red", problems: [{ severity: "red", message: "x" }] }] }))).toBe(1);
    expect(exitCodeOf(report({ global: [{ component: "suite a11y", status: "red", problems: [{ severity: "red", message: "x" }] }] }))).toBe(1);
  });
});

describe("render terminale e Markdown", () => {
  const sample = report({
    components: [
      { component: "Badge", status: "red", problems: [{ severity: "red", message: "file | divergente" }] },
      { component: "Input", status: "pending", problems: [{ severity: "pending", message: "pnpm adopt:variant -- Input" }] },
      { component: "AccordionItem", status: "ok", problems: [] },
    ],
    global: [{ component: "suite a11y", status: "ok", problems: [] }],
    notes: ["Gate drift SKIPPED — Penpot irraggiungibile"],
  });

  it("il terminale nomina ogni voce col suo esito e i problemi sotto", () => {
    const text = renderTerminal(sample);
    expect(text).toContain("3 componenti: 1 ok, 1 rossi, 1 in attesa");
    expect(text).toMatch(/Badge\s+✖ rosso/);
    expect(text).toMatch(/Input\s+⏸ in attesa/);
    expect(text).toMatch(/AccordionItem\s+✔ ok/);
    expect(text).toContain("[in attesa] pnpm adopt:variant -- Input");
    expect(text).toContain("Nota: Gate drift SKIPPED");
    expect(text).toContain("ALMENO UNA VOCE ROSSA");
  });

  it("il Markdown è una tabella per componente, con le pipe dei messaggi escapate", () => {
    const md = renderMarkdown(sample);
    expect(md).toContain("### gates:render");
    expect(md).toContain("| Componente | Esito | Problemi |");
    expect(md).toContain("| Badge | 🔴 rosso | [rosso] file \\| divergente |");
    expect(md).toContain("| Input | 🟡 in attesa |");
    expect(md).toContain("| AccordionItem | 🟢 ok | — |");
    expect(md).toContain("| Controllo globale | Esito | Problemi |");
  });
});

describe("publishReport — $GITHUB_STEP_SUMMARY", () => {
  it("appende il Markdown al file del summary quando la variabile esiste, e non scrive nulla altrimenti", () => {
    const dir = mkdtempSync(join(tmpdir(), "summary-"));
    try {
      const path = join(dir, "summary.md");
      const printed: string[] = [];
      const code = publishReport(
        report({ components: [{ component: "Badge", status: "ok", problems: [] }] }),
        { GITHUB_STEP_SUMMARY: path },
        (text) => printed.push(text),
      );
      expect(code).toBe(0);
      expect(readFileSync(path, "utf8")).toContain("| Badge | 🟢 ok | — |");
      expect(printed.join("\n")).toContain("Badge");

      const noSummary = publishReport(report(), {}, () => {});
      expect(noSummary).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
