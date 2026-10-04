import { readFileSync } from "node:fs";

import { parseLibrarySnapshot, readLibrarySnapshot, type CallToolFn } from "../library/library-reader";
import type { LibrarySnapshot, SnapshotComponent, SnapshotLayer } from "../library/library-snapshot";
import { toKebab } from "../shared/naming";
import { PATHS } from "../shared/paths";
import {
  outsideRoleProblem,
  propertyDefinition,
  propertyProblem,
  roleAdmits,
  type PartRole,
} from "../shared/style-properties";
import type { TokenCatalog } from "../shared/theme-generator";
import { ScriptError } from "../errors";
import { cellKey, expectedAxes, expectedCells, findContainers, partInCell, sameTokens } from "../library-plan";
import { resolveExtraction, knownExtractionNames } from "../registry";
import { parseArgs, type Command } from "../shell";
import {
  buildComponentSnapshot,
  componentSnapshotPathFor,
  componentSnapshotsEqual,
  diffComponentSnapshots,
  loadComponentSnapshot,
  writeComponentSnapshotAtomic,
  type ComponentSnapshot,
} from "../components";
import type { ExtractionContract } from "../extraction";

/**
 * `extract <Comp> [--check] [--snapshot <file>]` (Story 2.14, CAP-4): legge il
 * container Penpot (live o dal file indicato), lo valida nei cinque stadi
 * `penpot → contract → parts → properties → write` e scrive (tmp + rename)
 * `data/components/<kebab>.json` con `contract`, `provenance` e `cells` per
 * le 6 celle. `--check` confronta senza scrivere (exit 4 se diff).
 *
 * Solo `extract` scrive l'istantanea; mai in CI né in build; solo `library`
 * scrive su Penpot. `--snapshot` vale solo come seam di lettura/test, mai
 * come scrittura live. Nessuna classe di stile scritta a mano qui: solo token
 * letti da Penpot e controlli contro i due contratti e il registro.
 *
 * Categorie: uso/nome ignoto/file illeggibile → `input` (1); lettura MCP o
 * container assente → `penpot` (2); validazione → `contract` (3); diff di
 * `--check` → `gate` (4). Ogni stadio lancia una sola categoria e la nomina
 * nel log.
 */

export const EXTRACT_USAGE = "extract <Comp> [--check] [--snapshot <file>]";

export interface ExtractDeps {
  /** Seam per i test: snapshot di library già pronto, zero rete. Default: lettura live. */
  readonly readSnapshot?: () => Promise<LibrarySnapshot>;
  /** Seam di lettura per i test: transport mockato di `readLibrarySnapshot`. */
  readonly callTool?: CallToolFn;
  /** Seam per i test: cartella di destinazione invece di `data/components/`. */
  readonly componentsDir?: string;
  /** Seam per i test: catalogo iniettato invece del file committato. */
  readonly catalog?: TokenCatalog;
  /** Seam per i test: path del catalogo invece di `PATHS.catalogPath`. */
  readonly catalogPath?: string;
  /** Ora di provenienza iniettata per test deterministici (default: adesso). */
  readonly readAt?: string;
  readonly log?: (text: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function adaptationFooter(extraction: ExtractionContract, part?: string): string {
  const exRel = `packages/scripts/src/contracts/${extraction.contract.name}.extract.ts`;
  const partHint = part === undefined ? "" : ` (parte "${part}")`;
  return (
    `Adattamenti, in ordine: ` +
    `1) designer: correggi in Penpot la parte${partHint} nella cella indicata; ` +
    `2) sviluppatore, se il design è voluto: insegna al registro (packages/scripts/src/shared/style-properties.ts) con una riga + mappatura + test rosso/verde, una volta per tutte; ` +
    `3) sviluppatore, se il modello è da aggiornare: modifica il contratto di estrazione ${exRel}${partHint}.`
  );
}

/** Legge il catalogo Stadio 1 committato (fonte dei token esistenti). Fallimento = `input`. */
function assertCatalogShape(value: unknown, label: string): asserts value is TokenCatalog {
  if (value === null || typeof value !== "object" || !Array.isArray((value as { sets?: unknown }).sets)) {
    throw new ScriptError({ kind: "input", detail: `catalogo token malformato (${label}): atteso oggetto con array "sets".` });
  }
}

function loadCatalog(deps: ExtractDeps): TokenCatalog {
  if (deps.catalog !== undefined) {
    assertCatalogShape(deps.catalog, "<injected>");
    return deps.catalog;
  }
  const path = deps.catalogPath ?? PATHS.catalogPath;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new ScriptError({ kind: "input", detail: `catalogo token non leggibile (${path}): ${messageOf(error)}` });
  }
  assertCatalogShape(parsed, path);
  return parsed;
}

/** Seam `--snapshot <file>`: file validato alla fonte, errore `input` che nomina file e campo. */
function loadLibrarySnapshotFile(path: string): LibrarySnapshot {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new ScriptError({ kind: "input", detail: `file snapshot "${path}" non è JSON leggibile: ${messageOf(error)}` });
  }
  try {
    return parseLibrarySnapshot(json);
  } catch (error) {
    throw new ScriptError({ kind: "input", detail: `file snapshot "${path}" non è uno snapshot di library valido: ${messageOf(error)}` });
  }
}

interface SeenNode {
  readonly name: string;
  readonly tokens: Readonly<Record<string, string>>;
  readonly style: unknown;
  readonly parentLayer: string | null;
}

function collectSeen(root: SnapshotLayer): SeenNode[] {
  const seen: SeenNode[] = [];
  const visit = (node: SnapshotLayer, parentLayer: string | null): void => {
    seen.push({ name: node.name, tokens: node.tokens, style: node.style, parentLayer });
    for (const child of node.children) visit(child, node.name);
  };
  for (const child of root.children) visit(child, null);
  // La board radice non è una parte: i suoi token sono la parte "root", gestita a parte.
  return seen;
}

function layersByName(seen: readonly SeenNode[], layer: string): SeenNode[] {
  return seen.filter((node) => node.name === layer);
}

function hasRepeatAncestor(extraction: ExtractionContract, partName: string): boolean {
  let current = extraction.parts[partName]?.parent;
  while (current !== undefined) {
    const def = extraction.parts[current];
    if (def === undefined) return false;
    if (def.repeat !== undefined) return true;
    current = def.parent;
  }
  return false;
}

function tokenTypeOf(catalog: TokenCatalog, tokenName: string): string | undefined {
  for (const set of catalog.sets) {
    for (const token of set.tokens) {
      if (token.name === tokenName) return token.type;
    }
  }
  return undefined;
}

export function extractCommandWith(deps: ExtractDeps = {}): Command {
  const log = deps.log ?? console.log;
  return {
    name: "extract",
    usage: EXTRACT_USAGE,
    async run(argv) {
      const parsed = parseArgs(argv, { usage: EXTRACT_USAGE, flags: ["--check", "--help"], options: ["--snapshot"], positional: { min: 0, max: 1 } });
      if (parsed.flags.has("--help")) {
        log(`Uso: ${EXTRACT_USAGE}`);
        log(`  Legge il container Penpot (live o --snapshot <file>), valida nei 5 stadi e scrive data/components/<kebab>.json.`);
        log(`  --check confronta senza scrivere (exit 4 se diff). Live, mai in CI né in build.`);
        log(`  Contratti v2 noti: ${knownExtractionNames().join(", ")}`);
        return 0;
      }
      const [comp] = parsed.positional;
      if (comp === undefined) {
        throw new ScriptError({ kind: "input", detail: `argomento mancante (il componente) — uso: ${EXTRACT_USAGE}` });
      }
      const extraction = resolveExtraction(comp);
      const component = extraction.penpot.container;
      const check = parsed.flags.has("--check");
      const snapshotFile = parsed.options.get("--snapshot");
      const componentsDir = deps.componentsDir ?? PATHS.componentsDir;
      const catalog = loadCatalog(deps);
      const tokenNames = new Set<string>();
      for (const set of catalog.sets) for (const token of set.tokens) tokenNames.add(token.name);

      // Stadio penpot: lettura + container. Solo errori `penpot` oltre questa riga di log.
      log(`penpot: lettura del container "${component}" (plugin data atteso "${extraction.pluginData}")…`);
      let librarySnapshot: LibrarySnapshot;
      if (snapshotFile !== undefined) {
        librarySnapshot = loadLibrarySnapshotFile(snapshotFile);
      } else if (deps.readSnapshot !== undefined) {
        try {
          librarySnapshot = await deps.readSnapshot();
        } catch (error) {
          if (error instanceof ScriptError) throw error;
          throw new ScriptError({ kind: "penpot", component, detail: messageOf(error), cause: error });
        }
      } else {
        try {
          librarySnapshot = await readLibrarySnapshot(deps.callTool === undefined ? {} : { callTool: deps.callTool });
        } catch (error) {
          if (error instanceof ScriptError) throw error;
          throw new ScriptError({ kind: "penpot", component, detail: messageOf(error), cause: error });
        }
      }
      const containers = findContainers(librarySnapshot, extraction);
      if (containers.length === 0) {
        throw new ScriptError({
          kind: "penpot",
          component,
          detail: `container "${component}" assente in Penpot (plugin data atteso "${extraction.pluginData}"): crealo con "library add ${component}".`,
        });
      }
      if (containers.length > 1) {
        throw new ScriptError({
          kind: "penpot",
          component,
          detail: `contratto "${extraction.contract.name}": ${containers.length} container lo dichiarano (${containers.map((c) => `"${c.name}"`).join(", ")}) — un solo container per contratto.`,
        });
      }
      const container: SnapshotComponent = containers[0]!;
      log(`penpot: ok (container "${container.name}", ${container.cells.length} board lette).`);

      const axes = expectedAxes(extraction);
      const expectedKeys = expectedCells(extraction).map((cell) => cellKey(cell.variantProps, axes));
      // Stadio contract: assi, plugin data, celle complete. Solo errori `contract`.
      log(`contract: verifica di assi e celle (attese ${expectedKeys.length}, chiave promo=<v>|hover=<v>)…`);
      if (container.pluginData !== extraction.pluginData) {
        throw new ScriptError({
          kind: "contract",
          component,
          detail:
            `plugin data del container "${container.name}": atteso "${extraction.pluginData}", trovato ${container.pluginData === null ? "assente" : `"${container.pluginData}"`} — il plugin data lo scrive solo "library" (pagebuilder/contract sul container). ` +
            adaptationFooter(extraction),
        });
      }
      const actualByKey = new Map<string, SnapshotComponent["cells"][number]>();
      const keyCounts = new Map<string, number>();
      for (const [index, cell] of container.cells.entries()) {
        if (cell.variantError !== null) {
          const label = cell.variantProps === null ? `cella #${index} ("${cell.root.name}")` : `cella ${cellKey(cell.variantProps, axes.map((a) => ({ name: a.name })))}`;
          throw new ScriptError({
            kind: "contract",
            component,
            cell: cell.variantProps === null ? undefined : cellKey(cell.variantProps, axes.map((a) => ({ name: a.name }))),
            detail: `${label}: variantError "${cell.variantError}" in Penpot — risolvi l'errore di variante in Penpot. ${adaptationFooter(extraction)}`,
          });
        }
        if (cell.variantProps === null) {
          throw new ScriptError({
            kind: "contract",
            component,
            detail: `cella #${index} ("${cell.root.name}"): variantProps null (istanza main "Default", non una cella di variante) — ogni board del container deve dichiarare i variantProps del cartesiano atteso. ${adaptationFooter(extraction)}`,
          });
        }
        for (const extra of Object.keys(cell.variantProps).filter((name) => !axes.some((a) => a.name === name)).sort()) {
          throw new ScriptError({
            kind: "contract",
            component,
            cell: cellKey(cell.variantProps, axes.map((a) => ({ name: a.name }))),
            detail: `prop d'asse extra "${extra}"="${cell.variantProps[extra]}" senza voce nei contratti — rimuovila in Penpot o aggiungi l'asse nei contratti. ${adaptationFooter(extraction)}`,
          });
        }
        const key = cellKey(cell.variantProps, axes.map((a) => ({ name: a.name })));
        keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
        if (!actualByKey.has(key)) actualByKey.set(key, cell);
      }
      for (const [key, count] of [...keyCounts.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
        if (count > 1) {
          throw new ScriptError({
            kind: "contract",
            component,
            cell: key,
            detail: `cella ${key}: ${count} celle duplicate in Penpot con gli stessi variantProps — rimuovi i duplicati in Penpot. ${adaptationFooter(extraction)}`,
          });
        }
      }
      for (const key of expectedKeys) {
        if (!actualByKey.has(key)) {
          throw new ScriptError({
            kind: "contract",
            component,
            cell: key,
            detail: `cella ${key} assente in Penpot (attese ${expectedKeys.length} celle: ${expectedKeys.join(", ")}) — disegna la cella in Penpot o rimuovi il valore dal contratto. ${adaptationFooter(extraction)}`,
          });
        }
      }
      for (const key of [...actualByKey.keys()].filter((k) => !expectedKeys.includes(k)).sort()) {
        throw new ScriptError({
          kind: "contract",
          component,
          cell: key,
          detail: `cella ${key} in più in Penpot (fuori dal cartesiano ${expectedKeys.join(", ")}) — rimuovila in Penpot o aggiungi il valore nei contratti. ${adaptationFooter(extraction)}`,
        });
      }
      log(`contract: ok (${expectedKeys.length} celle complete, plugin data "${extraction.pluginData}").`);

      // Stadio parts: presenza per `when`, ripetizioni sul primo layer come modello, parentele. Solo `contract`.
      log(`parts: verifica di parti, when e repeat (${Object.keys(extraction.parts).length} parti, primo layer come modello)…`);
      const cellsTokens: Record<string, Record<string, Record<string, string>>> = {};
      const cellsKeywordValues: Record<string, Record<string, Record<string, string>>> = {};
      for (const key of expectedKeys) {
        const actual = actualByKey.get(key)!;
        const variantProps = actual.variantProps as Record<string, string>;
        const seen = collectSeen(actual.root);
        const actualNames = new Set(seen.map((node) => node.name));
        const expectedLayers = new Map<string, string>();
        for (const [partName, def] of Object.entries(extraction.parts)) {
          if (partName === "root") continue;
          if (!partInCell(extraction, partName, variantProps)) continue;
          expectedLayers.set(def.layer, partName);
        }
        // Presenza / when.
        for (const [layer, partName] of [...expectedLayers.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
          const occurrences = layersByName(seen, layer);
          const def = extraction.parts[partName]!;
          const isRepeat = def.repeat !== undefined || hasRepeatAncestor(extraction, partName);
          if (occurrences.length === 0) {
            const when = def.when === undefined ? "" : ` (when: ${JSON.stringify(def.when)})`;
            throw new ScriptError({
              kind: "contract",
              component,
              cell: key,
              part: partName,
              detail: `parte "${partName}" (layer "${layer}"${when}) assente in Penpot — disegna il layer in Penpot o rimuovi la parte dal contratto di estrazione. ${adaptationFooter(extraction, partName)}`,
            });
          }
          if (!isRepeat && occurrences.length > 1) {
            throw new ScriptError({
              kind: "contract",
              component,
              cell: key,
              part: partName,
              detail: `parte "${partName}" (layer "${layer}"): ${occurrences.length} layer duplicati in Penpot — rimuovi i duplicati in Penpot (la ripetizione vuole "repeat" nel contratto di estrazione). ${adaptationFooter(extraction, partName)}`,
            });
          }
          if (isRepeat && occurrences.length === 0) {
            throw new ScriptError({
              kind: "contract",
              component,
              cell: key,
              part: partName,
              detail: `parte ripetuta "${partName}" (layer "${layer}") assente in Penpot — disegna almeno un layer modello in Penpot. ${adaptationFooter(extraction, partName)}`,
            });
          }
          // Modello: gli altri layer ripetuti devono avere gli stessi token.
          if (occurrences.length > 1) {
            const model = occurrences[0]!.tokens;
            for (const [index, occurrence] of occurrences.entries()) {
              if (index === 0) continue;
              if (!sameTokens(model, occurrence.tokens)) {
                throw new ScriptError({
                  kind: "contract",
                  component,
                  cell: key,
                  part: partName,
                  detail: `parte ripetuta "${partName}" (layer "${layer}"): il layer #${index + 1} ha token ${JSON.stringify(occurrence.tokens)} diversi dal modello ${JSON.stringify(model)} (primo layer) — allinea i token in Penpot. ${adaptationFooter(extraction, partName)}`,
                });
              }
            }
          }
        }
        for (const layer of [...actualNames].filter((name) => !expectedLayers.has(name)).sort()) {
          // Layer di una parte esistente ma fuori `when` (es. Badge in promo=none).
          const guessed = Object.entries(extraction.parts).find(([, def]) => def.layer === layer)?.[0];
          if (guessed !== undefined) {
            const def = extraction.parts[guessed]!;
            const when = def.when === undefined ? null : def.when;
            if (when !== null) {
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: guessed,
                detail: `parte "${guessed}" (layer "${layer}") presente in Penpot ma il contratto la ammette solo con ${JSON.stringify(when)} — togli il layer in Penpot o allarga il "when" nel contratto di estrazione. ${adaptationFooter(extraction, guessed)}`,
              });
            }
            throw new ScriptError({
              kind: "contract",
              component,
              cell: key,
              part: guessed,
              detail: `parte "${guessed}" (layer "${layer}") presente in Penpot ma non attesa in questa cella (il genitore è fuori "when") — togli il layer in Penpot o riallinea il "when" nel contratto di estrazione. ${adaptationFooter(extraction, guessed)}`,
            });
          }
          throw new ScriptError({
            kind: "contract",
            component,
            cell: key,
            detail: `layer "${layer}" in Penpot senza voce nei contratti — aggiungi la parte nel contratto di estrazione (ruolo, parent, layer) e, se rende un field, il field nel page builder. ${adaptationFooter(extraction)}`,
          });
        }
        // Parentele: genitore reale contro `parent` del contratto.
        const partByLayer = new Map<string, string>();
        for (const [partName, def] of Object.entries(extraction.parts)) {
          if (partName === "root") continue;
          if (!partInCell(extraction, partName, variantProps)) continue;
          partByLayer.set(def.layer, partName);
        }
        for (const occurrence of seen) {
          const partName = partByLayer.get(occurrence.name);
          if (partName === undefined) continue;
          const expectedParent = extraction.parts[partName]!.parent ?? null;
          const expectedParentLayer = expectedParent === null || expectedParent === "root" ? null : extraction.parts[expectedParent]!.layer;
          if (occurrence.parentLayer !== expectedParentLayer) {
            throw new ScriptError({
              kind: "contract",
              component,
              cell: key,
              part: partName,
              detail: `parte "${partName}" (layer "${occurrence.name}"): genitore atteso ${expectedParentLayer === null ? `"root" (la board)` : `"${expectedParent}" (layer "${expectedParentLayer}")`}, trovato ${occurrence.parentLayer === null ? `"root" (la board)` : `(layer "${occurrence.parentLayer}")`} — riallinea la parentela in Penpot o il contratto di estrazione. ${adaptationFooter(extraction, partName)}`,
            });
          }
        }
        // Raccoglie i token modello per l'istantanea (primo layer per i repeat).
        const cellTokens: Record<string, Record<string, string>> = { root: { ...actual.root.tokens } };
        const cellKeywords: Record<string, Record<string, string>> = {};
        const keywordValuesOf = (node: SeenNode): Record<string, string> => {
          const out: Record<string, string> = {};
          if (node.style !== null && typeof node.style === "object" && !Array.isArray(node.style)) {
            for (const [prop, value] of Object.entries(node.style as Record<string, unknown>)) {
              const def = propertyDefinition(prop);
              if (def !== undefined && def.type.kind === "keyword" && typeof value === "string") {
                if (value !== def.type.default) out[prop] = value;
              }
            }
          }
          return out;
        };
        cellKeywords["root"] = keywordValuesOf(actual.root as unknown as SeenNode);
        for (const [partName, def] of Object.entries(extraction.parts)) {
          if (partName === "root") continue;
          if (!partInCell(extraction, partName, variantProps)) continue;
          const occurrence = layersByName(seen, def.layer)[0]!;
          cellTokens[partName] = { ...occurrence.tokens };
          const keywords = keywordValuesOf(occurrence);
          if (Object.keys(keywords).length > 0) cellKeywords[partName] = keywords;
        }
        cellsTokens[key] = cellTokens;
        cellsKeywordValues[key] = cellKeywords;
      }
      log(`parts: ok (when rispettato, repeat sul modello, parentele allineate).`);

      // Stadio properties: registro + ruoli + catalogo. Solo errori `contract`.
      log(`properties: verifica di token, ruoli e registro…`);
      for (const key of expectedKeys) {
        const cellTokens = cellsTokens[key]!;
        const cellKeywords = cellsKeywordValues[key]!;
        const variantProps = (actualByKey.get(key)!.variantProps as Record<string, string>)!;
        for (const [partName, tokens] of Object.entries(cellTokens)) {
          const role = extraction.parts[partName]!.role as PartRole;
          for (const [prop, token] of Object.entries(tokens).sort(([a], [b]) => (a < b ? -1 : 1))) {
            const problem = propertyProblem(prop, { component, cell: key, part: partName, token });
            if (problem !== null) {
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: partName,
                detail: `${problem} ${adaptationFooter(extraction, partName)}`,
              });
            }
            if (!roleAdmits(role, prop)) {
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: partName,
                detail: outsideRoleProblem(prop, role, { component, cell: key, part: partName, token }),
              });
            }
            const def = propertyDefinition(prop)!;
            if (def.type.kind === "keyword") {
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: partName,
                detail: `proprietà a parola chiave "${prop}" legata al token "${token}" (parte "${partName}", ruolo "${role}"): le parole chiave non hanno token. ${adaptationFooter(extraction, partName)}`,
              });
            }
            if (!tokenNames.has(token)) {
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: partName,
                detail: `token "${token}" su proprietà "${prop}" (parte "${partName}", ruolo "${role}") non esiste nel catalogo Stadio 1 — nessun valore inventato: lega un token esistente in Penpot. ${adaptationFooter(extraction, partName)}`,
              });
            }
            const actualType = tokenTypeOf(catalog, token);
            if (actualType !== undefined && actualType !== def.type.tokenType) {
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: partName,
                detail: `proprietà "${prop}" (parte "${partName}") legata al token "${token}" (type "${actualType}"), atteso type "${def.type.tokenType}" — wiring sbagliato in Penpot. ${adaptationFooter(extraction, partName)}`,
              });
            }
          }
          for (const [prop, value] of Object.entries(cellKeywords[partName] ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
            const def = propertyDefinition(prop);
            if (def === undefined || def.type.kind !== "keyword" || !def.type.values.includes(value)) {
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: partName,
                detail: `valore "${value}" fuori lista per "${prop}" (parte "${partName}"): ammessi [${def !== undefined && def.type.kind === "keyword" ? def.type.values.join(", ") : "?"}]. ${adaptationFooter(extraction, partName)}`,
              });
            }
            if (!roleAdmits(role, prop)) {
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: partName,
                detail: outsideRoleProblem(prop, role, { component, cell: key, part: partName, token: value }),
              });
            }
          }
        }
        // Stili valorizzati senza binding (solo proprietà a token): ogni stile vuole un token.
        const actual = actualByKey.get(key)!;
        const seen = collectSeen(actual.root);
        const holders: Array<{ label: string; part: string; tokens: Readonly<Record<string, string>>; style: unknown }> = [
          { label: `layer "${actual.root.name}" (parte "root")`, part: "root", tokens: actual.root.tokens, style: actual.root.style },
          ...seen.map((node) => {
            const part = Object.entries(extraction.parts).find(([, def]) => def.layer === node.name)?.[0] ?? node.name;
            return { label: `layer "${node.name}"`, part, tokens: node.tokens, style: node.style };
          }),
        ];
        for (const holder of holders) {
          if (holder.style === null || typeof holder.style !== "object" || Array.isArray(holder.style)) continue;
          for (const prop of Object.keys(holder.style as Record<string, unknown>).sort()) {
            const def = propertyDefinition(prop);
            if (def !== undefined && def.type.kind === "keyword") continue;
            if (holder.tokens[prop] === undefined) {
              // Proprietà di stile senza token: o non registrata o senza binding — entrambe `contract`.
              const problem = propertyProblem(prop, { component, cell: key, part: holder.part, value: (holder.style as Record<string, unknown>)[prop] });
              throw new ScriptError({
                kind: "contract",
                component,
                cell: key,
                part: holder.part,
                detail: `${holder.label}: stile "${prop}" valorizzato senza binding — lega il token in Penpot o rimuovi lo stile.${problem === null ? "" : ` ${problem}`} ${adaptationFooter(extraction, holder.part)}`,
              });
            }
          }
        }
        void variantProps;
      }
      log(`properties: ok (token esistenti, ruoli ammessi, registro verde).`);

      // Stadio write: tmp + rename o confronto. Solo errori `gate`.
      log(`write: ${check ? "confronto senza scrittura (--check)" : `scrittura di data/components/${toKebab(component)}.json`}…`);
      const mergedCells: ComponentSnapshot["cells"] = {};
      for (const key of expectedKeys) {
        mergedCells[key] = { ...cellsTokens[key]! };
        for (const [part, keywords] of Object.entries(cellsKeywordValues[key]!)) {
          if (Object.keys(keywords).length === 0) continue;
          // Le parole chiave viaggiano con i token nella stessa mappa di parte.
          mergedCells[key]![part] = { ...(mergedCells[key]![part] ?? {}), ...keywords };
        }
      }
      const fresh = buildComponentSnapshot({
        contract: extraction.pluginData,
        penpotComponentId: container.id,
        cells: mergedCells,
        readAt: deps.readAt,
      });
      const targetPath = componentSnapshotPathFor(component, componentsDir);
      if (check) {
        let current: ComponentSnapshot;
        try {
          current = loadComponentSnapshot(component, componentsDir);
        } catch (error) {
          if (error instanceof ScriptError && error.kind === "input") {
            throw new ScriptError({
              kind: "gate",
              component,
              detail: `istantanea attesa assente (${targetPath}): lancia "extract ${component}" per scriverla, poi ricontrolla — ${(error as ScriptError).detail}`,
            });
          }
          throw error;
        }
        if (componentSnapshotsEqual(current, fresh)) {
          log(`write: ok (identica, nessuna scrittura).`);
          return 0;
        }
        const diffs = diffComponentSnapshots(current, fresh);
        throw new ScriptError({
          kind: "gate",
          component,
          detail: `istantanea divergente (${targetPath}, ${diffs.length} differenze) — riestrai con "extract ${component}" e rivedi il diff in PR:\n${diffs.slice(0, 20).join("\n")}${diffs.length > 20 ? `\n… e altre ${diffs.length - 20}` : ""}`,
        });
      }
      writeComponentSnapshotAtomic(targetPath, fresh);
      log(`write: ok (scritta ${targetPath} con ${expectedKeys.length} celle, contract ${fresh.contract}).`);
      return 0;
    },
  };
}

export const extractCommand: Command = extractCommandWith();
