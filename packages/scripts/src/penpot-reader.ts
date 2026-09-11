import { callPenpotTool, isTextContent, resolveMcpEndpoint, type McpCallToolResult, type McpEndpoint } from "./mcp-client";
import type { TokenCatalog } from "./theme-generator";

/**
 * Client MCP minimale per leggere SOLO il catalogo token
 * (`penpot.library.local.tokens`). La lettura di componenti/varianti è in
 * component-reader.ts (Story 2.2). Endpoint e token vengono dall'ambiente
 * (`PENPOT_MCP_URL`, `PENPOT_MCP_TOKEN`): vedi mcp-client.ts.
 */

/**
 * Eseguito dentro il plugin Penpot via tool `execute_code`. Filtra ai soli
 * set `active` (penpot-conventions.md: solo i set attivi hanno effetto sui
 * token) e serializza nel contratto `{ sets: [{ name, tokens: [{ name,
 * type, value }] }] }` — niente `resolvedValue`: la risoluzione dei
 * riferimenti `{token.name}` è responsabilità di theme-generator.ts, non del
 * catalogo letto da Penpot.
 */
const READ_TOKEN_CATALOG_CODE = `
const catalog = penpot.library.local.tokens;
return {
  sets: catalog.sets
    .filter((set) => set.active)
    .map((set) => ({
      name: set.name,
      tokens: set.tokens.map((token) => ({
        name: token.name,
        type: token.type,
        value: token.value,
      })),
    })),
};
`;

function extractCatalog(result: McpCallToolResult): TokenCatalog {
  if (result.isError) {
    throw new Error(`Il tool execute_code di Penpot ha riportato un errore: ${JSON.stringify(result.content)}`);
  }

  const textContent = result.content?.find(isTextContent);
  if (!textContent) {
    throw new Error("Il tool execute_code di Penpot non ha restituito contenuto testuale — impossibile leggere il catalogo token.");
  }

  const envelope = JSON.parse(textContent.text) as { result?: TokenCatalog; log?: string };
  if (!envelope.result || !Array.isArray(envelope.result.sets)) {
    throw new Error("La risposta di execute_code non contiene un catalogo token valido (campo `result.sets` mancante).");
  }

  // Validazione dell'inner shape: un set senza tokens o un token senza
  // name/type/value passerebbe qui e crasherebbe più avanti con un TypeError
  // generico — meglio un errore di contratto che nomina il malformato.
  for (const set of envelope.result.sets) {
    if (!set || typeof set.name !== "string" || !Array.isArray(set.tokens)) {
      throw new Error(
        `Set malformato nel catalogo restituito da execute_code: atteso { name, tokens[] } — ricevuto ${JSON.stringify(set)?.slice(0, 200) ?? String(set)}.`,
      );
    }
    for (const token of set.tokens) {
      if (!token || typeof token.name !== "string" || typeof token.type !== "string" || token.value == null) {
        throw new Error(
          `Token malformato nel set "${set.name}": atteso { name, type, value } — ricevuto ${JSON.stringify(token)?.slice(0, 200) ?? String(token)}.`,
        );
      }
    }
  }

  return envelope.result;
}

/** L'endpoint si risolve alla chiamata, così il percorso offline non legge mai l'ambiente MCP. */
export async function readPenpotTokenCatalog(endpoint: McpEndpoint = resolveMcpEndpoint()): Promise<TokenCatalog> {
  const result = await callPenpotTool(
    endpoint,
    { name: "execute_code", arguments: { code: READ_TOKEN_CATALOG_CODE } },
    "chiamata al tool execute_code",
  );
  return extractCatalog(result);
}
