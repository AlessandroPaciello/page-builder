import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { readPenpotTokenCatalog } from "../penpot/penpot-reader";
import { readComponent } from "../penpot/read-component";
import { PATHS } from "../shared/paths";
import { createPdsServer } from "./server";

/**
 * Entrypoint del server MCP `pds` su stdio (Story 2.24), registrato in
 * `.mcp.json`. È l'unico punto di `src/server` che importa da `src/penpot`
 * (regola `server` del gate): lega l'adattatore vero e la root del repo.
 *
 * Lo stdout è il canale del protocollo: qui non si stampa niente. Il processo
 * resta vivo finché il client tiene aperto lo stdin; nessun `process.exit`.
 * Dopo una modifica del nucleo il server va riavviato (`/mcp` → reconnect).
 */

export async function startPdsServer(): Promise<void> {
  const server = createPdsServer({
    penpot: {
      readComponent: (name) => readComponent(name),
      readTokenCatalog: () => readPenpotTokenCatalog(),
    },
    root: PATHS.repoRoot,
  });
  await server.connect(new StdioServerTransport());
}

/** Vero solo se questo modulo è l'entry eseguita, mai a un `import` dei test. */
function isDirectInvocation(): boolean {
  if (process.argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  startPdsServer().catch((error: unknown) => {
    console.error(`✖ pds: avvio del server MCP fallito — ${error instanceof Error ? error.message : String(error)}`);
    // Il rifiuto rilanciato chiude il processo con un codice d'errore, senza `process.exit`.
    throw error;
  });
}
