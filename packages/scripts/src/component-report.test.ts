import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VerdictCollector,
  exitCodeOf,
  PROBLEM_KINDS,
  publishReport,
  renderJson,
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
    expect(statusOf([{ severity: "pending", kind: "pending", message: "p" }])).toBe("pending");
    expect(statusOf([{ severity: "pending", kind: "pending", message: "p" }, { severity: "red", kind: "other", message: "r" }])).toBe("red");

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
        { component: "Input", status: "pending", problems: [{ severity: "pending", kind: "pending", message: "adopt" }] },
      ],
    });
    expect(exitCodeOf(pending)).toBe(0);
    expect(exitCodeOf(report({ components: [{ component: "Badge", status: "red", problems: [{ severity: "red", kind: "other", message: "x" }] }] }))).toBe(1);
    expect(exitCodeOf(report({ global: [{ component: "suite a11y", status: "red", problems: [{ severity: "red", kind: "other", message: "x" }] }] }))).toBe(1);
  });
});

describe("render terminale e Markdown", () => {
  const sample = report({
    components: [
      { component: "Badge", status: "red", problems: [{ severity: "red", kind: "other", message: "file | divergente" }] },
      { component: "Input", status: "pending", problems: [{ severity: "pending", kind: "pending", message: "pnpm adopt:variant -- Input" }] },
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

describe("kind e JSON (Story 2.9)", () => {
  it("il collector assegna un kind a ogni problema: esplicito, oppure other (rosso) / pending (in attesa)", () => {
    const collector = new VerdictCollector();
    collector.red("Badge", "senza tipo");
    collector.pending("Badge", "in attesa senza tipo");
    collector.red("Input", "diverge", "drift");
    collector.pending("Input", "variante", "variant-not-adopted");
    const kinds = collector.verdicts().flatMap((v) => v.problems.map((p) => [v.component, p.severity, p.kind]));
    expect(kinds).toEqual([
      ["Badge", "red", "other"],
      ["Badge", "pending", "pending"],
      ["Input", "red", "drift"],
      ["Input", "pending", "variant-not-adopted"],
    ]);
  });

  it("l'unione dei kind è chiusa e contiene i percorsi della skill più other e pending", () => {
    expect([...PROBLEM_KINDS]).toEqual([
      "drift",
      "variant-not-adopted",
      "variant-not-adoptable",
      "missing-cell",
      "missing-cell-blocked",
      "missing-cell-undesigned",
      "cell-not-in-contract",
      "blocked-property",
      "contract-version",
      "snapshot-stale",
      "gate-failed",
      "pending",
      "other",
    ]);
  });

  it("renderJson: voci, esiti, problemi con severity/kind/message, note ed exitCode del comando", () => {
    const sample = report({
      components: [
        { component: "Badge", status: "pending", problems: [{ severity: "pending", kind: "variant-not-adopted", message: "m" }] },
        { component: "Input", status: "ok", problems: [] },
      ],
      global: [{ component: "regola 10 — contrasto", status: "ok", problems: [] }],
      notes: ["Gate drift SKIPPED — x"],
    });
    const json = JSON.parse(renderJson(sample));
    expect(json).toEqual({
      title: "gates:render",
      exitCode: 0,
      components: [
        { component: "Badge", status: "pending", problems: [{ severity: "pending", kind: "variant-not-adopted", message: "m" }] },
        { component: "Input", status: "ok", problems: [] },
      ],
      global: [{ component: "regola 10 — contrasto", status: "ok", problems: [] }],
      notes: ["Gate drift SKIPPED — x"],
    });
    const red = report({ components: [{ component: "Badge", status: "red", problems: [{ severity: "red", kind: "drift", message: "d" }] }] });
    expect(JSON.parse(renderJson(red)).exitCode).toBe(1);
  });

  it("con jsonPath il JSON è additivo: terminale, Markdown ed exit code identici a quelli senza flag", () => {
    const dir = mkdtempSync(join(tmpdir(), "json-"));
    try {
      const sample = report({
        components: [
          { component: "Badge", status: "red", problems: [{ severity: "red", kind: "drift", message: "diverge" }] },
          { component: "Input", status: "pending", problems: [{ severity: "pending", kind: "blocked-property", message: "b" }] },
        ],
      });
      const plainOut: string[] = [];
      const jsonOut: string[] = [];
      const plainSummary = join(dir, "plain.md");
      const jsonSummary = join(dir, "json.md");
      const jsonPath = join(dir, "report.json");
      const plainCode = publishReport(sample, { GITHUB_STEP_SUMMARY: plainSummary }, (text) => plainOut.push(text));
      const jsonCode = publishReport(sample, { GITHUB_STEP_SUMMARY: jsonSummary }, (text) => jsonOut.push(text), jsonPath);
      expect(jsonOut).toEqual(plainOut);
      expect(jsonCode).toBe(plainCode);
      expect(readFileSync(jsonSummary, "utf8")).toBe(readFileSync(plainSummary, "utf8"));
      expect(readFileSync(jsonPath, "utf8")).toBe(renderJson(sample));
      expect(existsSync(`${jsonPath}.tmp`)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
