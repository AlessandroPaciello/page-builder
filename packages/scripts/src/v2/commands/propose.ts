import { readLibrarySnapshot, type CallToolFn } from "../../library/library-reader";
import type { LibrarySnapshot } from "../../library/library-snapshot";
import { ScriptError } from "../errors";
import { findContainers } from "../library-plan";
import { diffPropose, contractLines, extractionRel, pageBuilderRel } from "../propose-diff";
import { knownExtractionNames, resolveExtraction } from "../registry";
import { parseArgs, type Command } from "../shell";

/**
 * `propose <Comp>` (Story 2.13, CAP-7): Penpot davanti ai contratti — legge il
 * container e stampa il diff sui due contratti, con file e riga. SOLA
 * LETTURA: mai scritture su Penpot né sui contratti né sugli snapshot.
 * Sostituisce `adopt:variant`, `bump:contract` e `role:part`. Live, mai in CI.
 *
 * Categorie: nome ignoto → `input` (1); container assente o lettura MCP
 * fallita → `penpot` (2). `--snapshot` non esiste qui: nei test il seam è la
 * DI (`readSnapshot`/`callTool`), non un flag CLI.
 */

export const PROPOSE_USAGE = "propose <Comp>";

export interface ProposeDeps {
  /** Seam per i test: snapshot già pronto, zero rete. Default: lettura live. */
  readonly readSnapshot?: () => Promise<LibrarySnapshot>;
  /** Seam di lettura per i test: transport mockato di `readLibrarySnapshot`. */
  readonly callTool?: CallToolFn;
  readonly log?: (text: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function proposeCommandWith(deps: ProposeDeps = {}): Command {
  const log = deps.log ?? console.log;
  return {
    name: "propose",
    usage: PROPOSE_USAGE,
    async run(argv) {
      const parsed = parseArgs(argv, { usage: PROPOSE_USAGE, flags: ["--help"], positional: { min: 0, max: 1 } });
      if (parsed.flags.has("--help")) {
        log(`Uso: ${PROPOSE_USAGE}`);
        log(`  Legge il container Penpot e stampa il diff sui due contratti (file e riga), senza mai scrivere.`);
        log(`  Contratti v2 noti: ${knownExtractionNames().join(", ")}`);
        return 0;
      }
      const [comp] = parsed.positional;
      if (comp === undefined) {
        throw new ScriptError({ kind: "input", detail: `argomento mancante (il componente) — uso: ${PROPOSE_USAGE}` });
      }
      const extraction = resolveExtraction(comp);
      let snapshot: LibrarySnapshot;
      try {
        snapshot = deps.readSnapshot
          ? await deps.readSnapshot()
          : await readLibrarySnapshot(deps.callTool === undefined ? {} : { callTool: deps.callTool });
      } catch (error: unknown) {
        if (error instanceof ScriptError) throw error;
        throw new ScriptError({ kind: "penpot", component: extraction.penpot.container, detail: messageOf(error), cause: error });
      }
      const containers = findContainers(snapshot, extraction);
      if (containers.length === 0) {
        throw new ScriptError({
          kind: "penpot",
          component: extraction.penpot.container,
          detail: `container "${extraction.penpot.container}" assente in Penpot (plugin data atteso "${extraction.pluginData}"): crealo con "library add ${extraction.penpot.container}".`,
        });
      }
      // Un solo container dichiara il contratto nella pratica; se ce ne sono
      // più, il diff li copre tutti senza scrivere (ogni riga col suo container).
      const lines = contractLines(extraction);
      const findings = containers.flatMap((container) =>
        diffPropose(extraction, container, lines).map((finding) => `[${container.name}|${container.pluginData ?? "?"}] ${finding}`),
      );
      if (findings.length === 0) {
        log(`Propose ${extraction.penpot.container}: nessun diff — Penpot è allineato ai contratti.`);
        return 0;
      }
      log(`Propose ${extraction.penpot.container} — Penpot davanti ai contratti (sola lettura, nessuna scrittura):`);
      log(`  page builder: ${pageBuilderRel(extraction)}:${lines.pageBuilderPromo}`);
      log(`  estrazione: ${extractionRel(extraction)}:${lines.extractionHover} (parti: ${extractionRel(extraction)}:${lines.extractionParts})`);
      for (const finding of findings) {
        log(`  - ${finding}`);
      }
      return 0;
    },
  };
}

export const proposeCommand: Command = proposeCommandWith();
