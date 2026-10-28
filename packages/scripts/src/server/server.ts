import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  buildOrder,
  componentPaths,
  generateComponent,
  isStopping,
  letturaName,
  scaleFromThemeCss,
  verifyComponent,
  type ContractRegistry,
  type CoreInput,
  type GenerateInput,
  type GenerateResult,
  type Lettura,
  type TokenType,
} from "../core";
import { generateTheme, type TokenCatalog } from "../shared/theme-generator";
import { generatedComponents } from "./generated-files";
import { NOT_YET, TOOLS } from "./tools";
import { writeChanges } from "./write-changes";

/**
 * Il server MCP `pds` (Story 2.24): l'unico guscio sopra il nucleo puro.
 *
 * - Penpot arriva per iniezione (`penpot`): questo modulo non importa da
 *   `src/penpot` (regola `server` del gate); solo `main.ts` lega l'adattatore
 *   vero.
 * - Nessuno stato: ogni chiamata rilegge il catalogo token (da cui
 *   `tokenTypeOf` e `scale`) e i componenti.
 * - Mai su Penpot: l'adattatore espone solo letture. Gli esiti del nucleo
 *   tornano così come sono.
 * - Scrive solo `generate_component`, solo i `Change` del nucleo e solo nella
 *   cartella del componente (`write-changes.ts`).
 * - Ogni errore (adattatore, nucleo, scrittura) è un risultato `isError` con
 *   il messaggio; l'ingresso non valido lo rifiuta lo schema zod dell'SDK,
 *   sempre come `isError`.
 */

/** Le letture di Penpot di cui il server ha bisogno. */
export interface PenpotAdapter {
  readonly readComponent: (name: string) => Promise<Lettura>;
  readonly readTokenCatalog: () => Promise<TokenCatalog>;
}

export interface PdsServerOptions {
  readonly penpot: PenpotAdapter;
  /** La root del repo: i path dei `Change` sono relativi a questa. */
  readonly root: string;
  /** I contratti; di default `COMPONENT_CONTRACTS` (come `CoreInput`). I test ne passano di scritti a mano. */
  readonly contracts?: ContractRegistry;
  /** Seam dei test: il generatore del nucleo; di default `generateComponent`. */
  readonly generate?: (lettura: Lettura, input: GenerateInput) => GenerateResult;
}

export const SERVER_NAME = "pds";
export const SERVER_VERSION = "0.0.0";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ok(structured: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Un handler che non lancia mai: un errore diventa `isError` col messaggio. */
function guarded<A>(handler: (args: A) => Promise<Record<string, unknown>>): (args: A) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return ok(await handler(args));
    } catch (error: unknown) {
      return fail(messageOf(error));
    }
  };
}

function readIfExists(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

/** `tokenTypeOf` e `scale` dal catalogo token: si rileggono a ogni chiamata. */
function coreContext(catalog: TokenCatalog, contracts: ContractRegistry | undefined): CoreInput {
  const types = new Map<string, TokenType>();
  for (const set of catalog.sets) for (const token of set.tokens) types.set(token.name, token.type);
  return {
    tokenTypeOf: (tokenName) => types.get(tokenName),
    scale: scaleFromThemeCss(generateTheme(catalog).css),
    ...(contracts === undefined ? {} : { contracts }),
  };
}

export function createPdsServer(options: PdsServerOptions): McpServer {
  const { penpot, root, contracts } = options;
  const generate = options.generate ?? generateComponent;
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  const context = async (): Promise<CoreInput> => coreContext(await penpot.readTokenCatalog(), contracts);
  const existing = (name: string) => {
    const paths = componentPaths(name);
    const tsx = readIfExists(join(root, paths.tsx));
    const styles = readIfExists(join(root, paths.styles));
    const stories = readIfExists(join(root, paths.stories));
    return {
      ...(tsx === undefined ? {} : { existingTsx: tsx }),
      ...(styles === undefined ? {} : { existingStyles: styles }),
      ...(stories === undefined ? {} : { existingStories: stories }),
    };
  };

  server.registerTool(
    "describe_component",
    { description: TOOLS.describe_component.description, inputSchema: TOOLS.describe_component.input, outputSchema: TOOLS.describe_component.output },
    guarded(async ({ name }) => await penpot.readComponent(name)),
  );

  server.registerTool(
    "verify_component",
    { description: TOOLS.verify_component.description, inputSchema: TOOLS.verify_component.input, outputSchema: TOOLS.verify_component.output },
    guarded(async ({ name }) => {
      const lettura = await penpot.readComponent(name);
      const input = await context();
      const { existingTsx } = existing(letturaName(lettura, contracts));
      return { findings: verifyComponent(lettura, { ...input, ...(existingTsx === undefined ? {} : { existingTsx }) }) };
    }),
  );

  server.registerTool(
    "build_order",
    { description: TOOLS.build_order.description, inputSchema: TOOLS.build_order.input, outputSchema: TOOLS.build_order.output },
    guarded(async ({ names }) => {
      const letture: Lettura[] = [];
      for (const name of names) letture.push(await penpot.readComponent(name));
      const result = buildOrder(letture, generatedComponents(root), contracts);
      return { order: result.order, findings: result.findings };
    }),
  );

  server.registerTool(
    "generate_component",
    { description: TOOLS.generate_component.description, inputSchema: TOOLS.generate_component.input, outputSchema: TOOLS.generate_component.output },
    guarded(async ({ name }) => {
      const lettura = await penpot.readComponent(name);
      const input = await context();
      const component = letturaName(lettura, contracts);
      const result = generate(lettura, { ...input, ...existing(component), generated: generatedComponents(root) });
      // Con un blocco o una domanda aperta non si scrive niente, qualunque cosa contengano i `changes`.
      const written = result.findings.some(isStopping) ? [] : writeChanges(root, component, result.changes);
      return { changes: result.changes, findings: result.findings, suggestions: result.suggestions, written };
    }),
  );

  server.registerTool("tokens_from_css", { description: TOOLS.tokens_from_css.description, inputSchema: TOOLS.tokens_from_css.input }, () => fail(`tokens_from_css: ${NOT_YET}.`));

  server.registerTool("extract_theme", { description: TOOLS.extract_theme.description, inputSchema: TOOLS.extract_theme.input }, () => fail(`extract_theme: ${NOT_YET}.`));

  return server;
}
