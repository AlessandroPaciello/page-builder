import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Piccolo modulo condiviso per i client MCP Penpot (Story 2.2): timeout,
 * riconoscimento del contenuto testuale e validazione esplicita
 * dell'envelope `execute_code`. Stesso stile del precedente di `penpot-reader.ts`
 * (Story 2.1): errori che nominano il campo malformato, nessun parsing
 * silenzioso.
 */
export const MCP_TIMEOUT_MS = 15_000;

export async function withTimeout<T>(
  operation: Promise<T>,
  description: string,
  timeoutMs: number = MCP_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Timeout (${timeoutMs}ms) su ${description} — il server MCP Penpot non risponde: verifica che Penpot sia attivo e raggiungibile.`,
        ),
      );
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
    // Solo quando il timeout ha vinto la race `operation` resta pendente: un
    // suo reject successivo sarebbe un unhandled rejection altrimenti non
    // intercettato. Attacchiamo il catch diagnostico SOLO in quel caso — se
    // `operation` vince la race (il caso comune), il suo reject è già gestito
    // dall'`await` sopra e ri-agganciare qui logherebbe due volte lo stesso
    // errore legittimo. Nell'unico chiamante reale (il CLI, `extract-component.ts`),
    // l'errore di timeout propagato fa terminare il processo (`process.exit`)
    // subito dopo: questo `console.error` serve soprattutto a garantire che
    // il reject tardivo sia SEMPRE agganciato (mai un unhandled rejection),
    // non a garantire che venga sempre stampato prima dell'uscita.
    if (timedOut) {
      operation.catch((error: unknown) => {
        console.error(`Rifiuto tardivo (dopo il timeout) su ${description}:`, error);
      });
    }
  }
}

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpCallToolResult {
  content?: Array<McpTextContent | { type: string; [key: string]: unknown }>;
  isError?: boolean;
}

export function isTextContent(content: { type: string }): content is McpTextContent {
  return content.type === "text";
}

export interface ExecuteCodeEnvelope {
  result: unknown;
  log?: string;
}

/**
 * Valida l'envelope del tool `execute_code` per una lettura `what`: errore
 * esplicito (che nomina cosa mancava) su isError, assenza di testo o `result`
 * mancante. Mai un fallback silenzioso.
 */
export function parseExecuteCodeEnvelope(result: McpCallToolResult, what: string): ExecuteCodeEnvelope {
  if (result.isError) {
    throw new Error(`Il tool execute_code di Penpot ha riportato un errore: ${JSON.stringify(result.content)}`);
  }
  const textContent = result.content?.find(isTextContent);
  if (!textContent) {
    throw new Error(`Il tool execute_code di Penpot non ha restituito contenuto testuale — ${what}.`);
  }
  let envelope: { result?: unknown; log?: string };
  try {
    envelope = JSON.parse(textContent.text) as { result?: unknown; log?: string };
  } catch (error) {
    throw new Error(
      `La risposta di execute_code non è JSON valido — ${what}: ${(error as Error).message}. Testo ricevuto: ${textContent.text.slice(0, 200)}`,
    );
  }
  if (!envelope || envelope.result === undefined) {
    throw new Error(`La risposta di execute_code non contiene un envelope valido (campo \`result\` mancante) — ${what}.`);
  }
  return envelope as ExecuteCodeEnvelope;
}

/**
 * Endpoint MCP Penpot (spec-penpot-mcp-token): lo stesso per Claude Code,
 * OpenCode e script — il proxy del frontend Penpot su `:9001/mcp/stream`,
 * attivo con il flag `enable-mcp`. Il token personale viaggia solo come
 * query `userToken`, come nello snippet mostrato da Penpot in
 * Settings → Integrations.
 */
export const DEFAULT_PENPOT_MCP_URL = "http://localhost:9001/mcp/stream";

export interface McpEndpoint {
  /** URL reale, con `userToken` se presente: mai stamparlo, usare `displayUrl`. */
  url: URL;
  /** URL con `userToken` mascherato: l'unico da usare in log e messaggi d'errore. */
  displayUrl: string;
  hasToken: boolean;
}

export function maskMcpUrl(url: URL): string {
  if (!url.searchParams.has("userToken")) return url.toString();
  const masked = new URL(url);
  masked.searchParams.set("userToken", "***");
  // `URLSearchParams` codifica `*` come `%2A`: il messaggio resta leggibile.
  return masked.toString().replace("userToken=%2A%2A%2A", "userToken=***");
}

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Risolve l'endpoint dalle variabili d'ambiente: `PENPOT_MCP_URL`
 * (facoltativa, default {@link DEFAULT_PENPOT_MCP_URL}) e `PENPOT_MCP_TOKEN`
 * (facoltativo, aggiunto o sovrascritto come `userToken`). Valori vuoti o
 * solo spazi contano come assenti. Da chiamare solo nei percorsi live: il
 * percorso offline sulla fixture non deve mai dipendere dall'ambiente MCP.
 */
export function resolveMcpEndpoint(env: NodeJS.ProcessEnv = process.env): McpEndpoint {
  const rawUrl = envValue(env, "PENPOT_MCP_URL") ?? DEFAULT_PENPOT_MCP_URL;
  let url: URL | undefined;
  try {
    url = new URL(rawUrl);
  } catch {
    // fallthrough: errore sotto
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    // Il valore grezzo può contenere un userToken: lo si ripete solo se non c'è.
    const shown = rawUrl.includes("userToken") ? "(valore con userToken, non mostrato)" : `"${rawUrl}"`;
    throw new Error(`PENPOT_MCP_URL non è un URL http(s) valido: ${shown} — atteso per esempio ${DEFAULT_PENPOT_MCP_URL}.`);
  }
  const token = envValue(env, "PENPOT_MCP_TOKEN");
  if (token) url.searchParams.set("userToken", token);
  // Anche un userToken già presente in PENPOT_MCP_URL conta come token inviato.
  return { url, displayUrl: maskMcpUrl(url), hasToken: Boolean(url.searchParams.get("userToken")) };
}

function authFailure(endpoint: McpEndpoint, reason: string): Error {
  const hint = endpoint.hasToken
    ? "il token in PENPOT_MCP_TOKEN non è valido o è stato rigenerato, oppure il plugin MCP Server non è connesso in Penpot con questo utente: copia il token attuale da Settings → Integrations e riconnetti il plugin (File → Plugins → MCP Server → Connect)"
    : "l'endpoint richiede un token: genera il token personale in Penpot (Settings → Integrations → MCP server) ed esportalo come PENPOT_MCP_TOKEN";
  return new Error(`Il server MCP Penpot (${endpoint.displayUrl}) ha rifiutato la richiesta (${reason}) — ${hint}.`);
}

/**
 * Rifiuti del server Penpot in multi-user: arrivano come testo del tool
 * (`Tool execution failed: Error: ...`), non come HTTP 401 — verificato su
 * Penpot 2.17.2. Se una versione futura cambia il testo, l'errore torna
 * generico ma non silenzioso.
 */
const TOOL_FAILURE_PREFIX = "Tool execution failed";
const TOOL_AUTH_REJECTIONS = ["No userToken found in session context", "No Penpot instance connected for user token"];

function toolAuthRejection(result: McpCallToolResult): string | undefined {
  for (const content of result.content ?? []) {
    if (!isTextContent(content) || !content.text.startsWith(TOOL_FAILURE_PREFIX)) continue;
    const marker = TOOL_AUTH_REJECTIONS.find((candidate) => content.text.includes(candidate));
    if (marker) return marker;
  }
  return undefined;
}

/** Status HTTP dal `StreamableHTTPError` dell'SDK (campo `code`). */
function httpStatus(error: unknown): number | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "number" && code >= 400 ? code : undefined;
}

function endpointNotFound(endpoint: McpEndpoint, status: number): Error {
  return new Error(
    `L'endpoint MCP Penpot (${endpoint.displayUrl}) ha risposto HTTP ${status} — il proxy MCP non è attivo: verifica che PENPOT_FLAGS contenga enable-mcp e che PENPOT_MCP_URL punti a /mcp/stream.`,
  );
}

/** Tutte le forme in cui il token può comparire in un messaggio: in chiaro e codificato come query. */
function tokenForms(endpoint: McpEndpoint): string[] {
  const token = endpoint.url.searchParams.get("userToken");
  if (!token) return [];
  const encoded = new URLSearchParams({ t: token }).toString().slice(2);
  return [...new Set([token, encoded, encodeURIComponent(token)])];
}

/** Rete di sicurezza: nessun errore che risale da qui (né che viene loggato) contiene il valore del token. */
function redactToken(error: unknown, endpoint: McpEndpoint): unknown {
  const forms = tokenForms(endpoint);
  if (forms.length === 0) return error;
  const redact = (text: string) => forms.reduce((acc, form) => acc.split(form).join("***"), text);
  if (!(error instanceof Error)) {
    const text = String(error);
    return forms.some((form) => text.includes(form)) ? new Error(redact(text)) : error;
  }
  const leaks = [error.message, error.stack ?? ""].some((text) => forms.some((form) => text.includes(form)));
  if (!leaks) return error;
  // Il `cause` originale non viene propagato: potrebbe contenere il token.
  // Resta solo lo status HTTP (`code`), che serve a tradurre 401/403/404.
  const redacted = Object.assign(new Error(redact(error.message)), { code: (error as { code?: unknown }).code });
  redacted.stack = redact(error.stack ?? redacted.stack ?? "");
  return redacted;
}

const CLOSE_TIMEOUT_MS = 2_000;

/**
 * Connette, chiama UN tool e chiude. Traduce i rifiuti di autenticazione
 * (HTTP 401/403 o testo di rifiuto del tool) in errori che nominano
 * `PENPOT_MCP_TOKEN`; ogni URL nei messaggi è mascherato.
 */
export async function callPenpotTool(
  endpoint: McpEndpoint,
  args: { name: string; arguments: Record<string, unknown> },
  description: string,
  timeoutMs?: number,
): Promise<McpCallToolResult> {
  const client = new Client({ name: "penpot-ds-scripts", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(endpoint.url);
  // Redazione PRIMA di withTimeout: anche il rifiuto tardivo che withTimeout logga è già pulito.
  const redacted = <T>(operation: Promise<T>) =>
    operation.catch((error: unknown) => {
      throw redactToken(error, endpoint);
    });
  try {
    await withTimeout(redacted(client.connect(transport)), `connessione al server MCP Penpot (${endpoint.displayUrl})`, timeoutMs);
    const result = (await withTimeout(redacted(client.callTool(args)), description, timeoutMs)) as McpCallToolResult;
    const rejection = toolAuthRejection(result);
    if (rejection) throw authFailure(endpoint, rejection);
    return result;
  } catch (error) {
    const status = httpStatus(error);
    if (status === 401 || status === 403) throw authFailure(endpoint, `HTTP ${status}`);
    if (status === 404 || status === 405) throw endpointNotFound(endpoint, status);
    throw redactToken(error, endpoint);
  } finally {
    // La close non deve mai mascherare l'errore primario, né appendere il CLI
    // (DELETE di sessione verso un server che non risponde).
    const timer = new Promise<void>((resolve) => setTimeout(resolve, CLOSE_TIMEOUT_MS).unref());
    try {
      await Promise.race([client.close(), timer]);
    } catch {
      // ignorato deliberatamente: conta l'esito dell'operazione
    }
  }
}
