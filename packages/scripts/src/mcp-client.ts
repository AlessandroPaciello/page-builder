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
