import { appendFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Esito per componente (Story 2.8 parte B): `verify:library` e `gates:render`
 * non hanno più un esito unico. Ogni componente ha la sua voce — `ok`,
 * `red` (rosso) o `pending` (in attesa) — con i problemi nominativi; i
 * controlli globali (copertura spec, tema, contrasto, suite a11y) restano
 * righe globali. L'exit code è 1 SOLO se almeno una voce è rossa (decisione
 * 1 di Alessandro, 2026-09-13): gli in attesa stanno nel report, non nell'exit.
 */

export type VerdictStatus = "ok" | "red" | "pending";

/**
 * Tipo del problema (Story 2.9): unione CHIUSA che decide il percorso della
 * skill `pds-component` [PS] — la skill instrada sul `kind`, mai sul testo
 * del messaggio (AD-11: il percorso sta negli script). Un problema senza un
 * tipo più preciso vale `other` (rosso) o `pending` (in attesa): la skill lo
 * riporta e si ferma.
 */
export const PROBLEM_KINDS = [
  /** Gate 5: la fixture committata diverge da Penpot live → riestrarre. */
  "drift",
  /** Valore d'asse `option` in Penpot non adottato (o cella di quel valore) → decisione + `adopt:variant`. */
  "variant-not-adopted",
  /** Valore in più su un asse `state`/`behavior`: `adopt:variant` non lo adotta → designer. */
  "variant-not-adoptable",
  /** Cella del contratto assente in Penpot, prevista dal design e creabile → `add:library` (`addCell`). */
  "missing-cell",
  /** Come sopra, ma `addCell` è bloccato (ordine degli assi, plugin data non corrente) → il blocco nominativo. */
  "missing-cell-blocked",
  /** Cella del contratto assente in Penpot e dal design committato → domanda al designer, mai inventata. */
  "missing-cell-undesigned",
  /** Cella in Penpot fuori dal prodotto cartesiano del contratto → blocco + domanda al designer. */
  "cell-not-in-contract",
  /** Proprietà bloccata dal registro → sblocco (riga + mappatura + test rosso/verde), decisione umana. */
  "blocked-property",
  /** Plugin data `nome@versione` ≠ contratto corrente (regola 3) → regola A, `bump:contract`. */
  "contract-version",
  /** Componente committato assente dallo snapshot da file → `verify:library --write-snapshot`. */
  "snapshot-stale",
  /** Gate di `gates:render` rosso (completezza, rigenerazione, conformità, a11y). */
  "gate-failed",
  /** In attesa di altro, senza un percorso proprio. */
  "pending",
  /** Nessun tipo noto: la skill lo riporta e si ferma. */
  "other",
] as const;

export type ProblemKind = (typeof PROBLEM_KINDS)[number];

export interface Problem {
  readonly severity: "red" | "pending";
  readonly kind: ProblemKind;
  readonly message: string;
}

export interface ComponentVerdict {
  readonly component: string;
  readonly status: VerdictStatus;
  readonly problems: readonly Problem[];
}

export interface ComponentReport {
  /** Nome del comando che produce il report (titolo della sezione). */
  readonly title: string;
  readonly components: readonly ComponentVerdict[];
  /** Controlli globali (fuori dalle voci per componente), stessa forma. */
  readonly global: readonly ComponentVerdict[];
  /** Note informative (es. gate drift saltato col motivo): non cambiano l'esito. */
  readonly notes: readonly string[];
}

/** Stato di una voce dai suoi problemi: rosso se ne ha uno rosso, poi in attesa, altrimenti ok. */
export function statusOf(problems: readonly Problem[]): VerdictStatus {
  if (problems.some((problem) => problem.severity === "red")) return "red";
  if (problems.length > 0) return "pending";
  return "ok";
}

/**
 * Aggregatore: raccoglie i problemi da più fonti (regole, gate) per
 * componente, preservando l'ordine d'inserimento dei componenti dichiarati.
 */
export class VerdictCollector {
  private readonly byComponent = new Map<string, Problem[]>();

  /** Dichiara un componente (compare nel report anche senza problemi, come `ok`). */
  declare(component: string): void {
    if (!this.byComponent.has(component)) this.byComponent.set(component, []);
  }

  add(component: string, severity: Problem["severity"], message: string, kind: ProblemKind): void {
    this.declare(component);
    this.byComponent.get(component)!.push({ severity, kind, message });
  }

  /** Problema rosso; senza un tipo più preciso vale `other`. */
  red(component: string, message: string, kind: ProblemKind = "other"): void {
    this.add(component, "red", message, kind);
  }

  /** Problema in attesa; senza un tipo più preciso vale `pending`. */
  pending(component: string, message: string, kind: ProblemKind = "pending"): void {
    this.add(component, "pending", message, kind);
  }

  verdicts(): ComponentVerdict[] {
    return [...this.byComponent].map(([component, problems]) => ({ component, status: statusOf(problems), problems }));
  }
}

export function hasRed(report: ComponentReport): boolean {
  return [...report.components, ...report.global].some((verdict) => verdict.status === "red");
}

/** Decisione 1: 1 solo con almeno una voce rossa; ok e in attesa → 0. */
export function exitCodeOf(report: ComponentReport): number {
  return hasRed(report) ? 1 : 0;
}

const TERMINAL_LABEL: Record<VerdictStatus, string> = { ok: "✔ ok", red: "✖ rosso", pending: "⏸ in attesa" };
const MARKDOWN_LABEL: Record<VerdictStatus, string> = { ok: "🟢 ok", red: "🔴 rosso", pending: "🟡 in attesa" };

function counts(report: ComponentReport): string {
  const all = report.components;
  const of = (status: VerdictStatus): number => all.filter((verdict) => verdict.status === status).length;
  return `${all.length} componenti: ${of("ok")} ok, ${of("red")} rossi, ${of("pending")} in attesa`;
}

function problemLine(problem: Problem): string {
  return `${problem.severity === "red" ? "[rosso]" : "[in attesa]"} ${problem.message}`;
}

/** Tabella in testo per il terminale: una riga per voce, i problemi indentati sotto. */
export function renderTerminal(report: ComponentReport): string {
  const lines: string[] = [`${report.title} — ${counts(report)}`];
  const width = Math.max(10, ...[...report.components, ...report.global].map((verdict) => verdict.component.length));
  const section = (label: string, verdicts: readonly ComponentVerdict[]): void => {
    if (verdicts.length === 0) return;
    lines.push(label);
    for (const verdict of verdicts) {
      lines.push(`  ${verdict.component.padEnd(width)}  ${TERMINAL_LABEL[verdict.status]}`);
      for (const problem of verdict.problems) lines.push(`      - ${problemLine(problem)}`);
    }
  };
  section("Componenti:", report.components);
  section("Controlli globali:", report.global);
  for (const note of report.notes) lines.push(`Nota: ${note}`);
  lines.push(hasRed(report) ? `${report.title}: ALMENO UNA VOCE ROSSA (exit 1).` : `${report.title}: nessuna voce rossa (exit 0).`);
  return lines.join("\n");
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

/** Stessa tabella in Markdown, per `$GITHUB_STEP_SUMMARY` (pagina di riepilogo del job). */
export function renderMarkdown(report: ComponentReport): string {
  const lines: string[] = [`### ${report.title}`, "", `${counts(report)}.`, ""];
  const table = (heading: string, verdicts: readonly ComponentVerdict[]): void => {
    if (verdicts.length === 0) return;
    lines.push(`| ${heading} | Esito | Problemi |`, "| --- | --- | --- |");
    for (const verdict of verdicts) {
      const problems = verdict.problems.map((problem) => escapeCell(problemLine(problem))).join("<br>");
      lines.push(`| ${escapeCell(verdict.component)} | ${MARKDOWN_LABEL[verdict.status]} | ${problems || "—"} |`);
    }
    lines.push("");
  };
  table("Componente", report.components);
  table("Controllo globale", report.global);
  for (const note of report.notes) lines.push(`> ${escapeCell(note)}`, "");
  return `${lines.join("\n")}\n`;
}

/**
 * Lo stesso report per la macchina (Story 2.9): ogni problema porta
 * `severity`, `kind` e `message`; `exitCode` è quello del comando. È ciò che
 * legge la skill `pds-component` per scegliere il percorso.
 */
export function renderJson(report: ComponentReport): string {
  const verdict = (entry: ComponentVerdict) => ({
    component: entry.component,
    status: entry.status,
    problems: entry.problems.map((problem) => ({ severity: problem.severity, kind: problem.kind, message: problem.message })),
  });
  const payload = {
    title: report.title,
    exitCode: exitCodeOf(report),
    components: report.components.map(verdict),
    global: report.global.map(verdict),
    notes: [...report.notes],
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** Scrive il JSON con tmp + rename: un fallimento non lascia un file a metà. */
export function writeJsonReport(path: string, report: ComponentReport): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, renderJson(report), "utf8");
  renameSync(tmp, path);
}

/**
 * Stampa il report nel terminale e, se `GITHUB_STEP_SUMMARY` esiste, lo
 * appende in Markdown (decisione 2: nessun permesso nuovo nel workflow).
 * Con `jsonPath` (flag `--json <path>`, Story 2.9) scrive ANCHE il JSON su
 * file: additivo, terminale, Markdown ed exit code restano identici.
 * Restituisce l'exit code secondo la decisione 1.
 */
export function publishReport(
  report: ComponentReport,
  env: NodeJS.ProcessEnv = process.env,
  print: (text: string) => void = (text) => console.log(text),
  jsonPath?: string,
): number {
  print(renderTerminal(report));
  const summary = env.GITHUB_STEP_SUMMARY;
  if (summary !== undefined && summary.trim().length > 0) {
    appendFileSync(summary, renderMarkdown(report), "utf8");
  }
  if (jsonPath !== undefined) writeJsonReport(jsonPath, report);
  return exitCodeOf(report);
}
