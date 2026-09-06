import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type { TokenCatalog } from "./theme-generator";

/**
 * Client MCP minimale per leggere SOLO il catalogo token
 * (`penpot.library.local.tokens`). La lettura di componenti/varianti per la
 * pipeline Stage 2 è fuori scope qui — vedi Story 2.2/2.3.
 */
const DEFAULT_PENPOT_MCP_URL = "http://127.0.0.1:4401/mcp";

/** Timeout per le operazioni MCP: un server che accetta TCP ma non risponde non deve appendere la pipeline all'infinito. */
const MCP_TIMEOUT_MS = 15_000;

async function withTimeout<T>(operation: Promise<T>, description: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `Timeout (${MCP_TIMEOUT_MS}ms) su ${description} — il server MCP Penpot non risponde: verifica che Penpot sia attivo e raggiungibile.`,
          ),
        ),
      MCP_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

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

interface McpTextContent {
  type: "text";
  text: string;
}

interface McpCallToolResult {
  content?: Array<McpTextContent | { type: string; [key: string]: unknown }>;
  isError?: boolean;
}

function isTextContent(content: { type: string }): content is McpTextContent {
  return content.type === "text";
}

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

export async function readPenpotTokenCatalog(mcpUrl: string = DEFAULT_PENPOT_MCP_URL): Promise<TokenCatalog> {
  const client = new Client({ name: "penpot-ds-scripts", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  await withTimeout(client.connect(transport), `connessione al server MCP Penpot (${mcpUrl})`);

  try {
    const result = (await withTimeout(
      client.callTool({
        name: "execute_code",
        arguments: { code: READ_TOKEN_CATALOG_CODE },
      }),
      "chiamata al tool execute_code",
    )) as McpCallToolResult;
    return extractCatalog(result);
  } catch (error) {
    // L'errore di close non deve mai mascherare l'errore originale.
    try {
      await client.close();
    } catch {
      // ignorato deliberatamente: conta l'errore primario
    }
    throw error;
  }
  await client.close();
}
