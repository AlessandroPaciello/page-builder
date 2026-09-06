import { createContext } from "@app/api/context";
import { mapDomainErrors } from "@app/api/errors";
import { appRouter } from "@app/api/routers/index";
import { verifyTrustedOrigin } from "@app/api/origin-guard";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { NextRequest } from "next/server";

const RPC_PREFIX = "/api/rpc";
const API_REFERENCE_PREFIX = "/api/rpc/api-reference";

// La reference OpenAPI descrive l'intera superficie API: in produzione è
// ricognizione gratuita per un attaccante. Resta accesa solo fuori da prod.
//
// Legge `process.env.NODE_ENV` direttamente, non `env.NODE_ENV`: lo schema
// Zod di `packages/env` di default a "development" se la variabile non è
// impostata, quindi un confronto `!== "production"` sull'env validato fallisce
// APERTO — espone la reference — proprio nel caso (un deploy che dimentica
// NODE_ENV, es. uno standalone Docker in Story 1.6) in cui questo gate serve
// di più. Qui vogliamo il fail-closed opposto: si espone solo con un opt-in
// esplicito a "development".
const exposeApiReference = process.env.NODE_ENV === "development";

// Guard Origin/CSRF per le mutation (Story 1.5, chiusura deferred-work 1-1).
// Legge `process.env.CORS_ORIGIN` direttamente, non l'env validato: con
// `@t3-oss/env-core` una variabile mancante lancia ALL'IMPORT, rompendo anche
// i GET. Qui vogliamo il fail-closed chirurgico: la config mancante nega solo
// le mutation (lista vuota → guard negato), i GET restano servibili.
//
// L'allow-list è normalizzata via `new URL().origin` (non solo lo slash
// finale): case-fold dell'host, porta default rimossa, eventuale path
// scartato — l'origin della richiesta è già normalizzato così, e un
// confronto grezzo negherebbe per sempre client legittimi (`HTTP://x:443`,
// `https://x.com/app`). Un valore non-URL lancia qui, al boot: fail-loud
// esplicito su una config rotta, non deny silenzioso in produzione.
const trustedOrigins = process.env.CORS_ORIGIN
  ? [new URL(process.env.CORS_ORIGIN).origin]
  : [];

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    // Mapping AD-13 (dominio → set oRPC fisso) applicato UNA volta sola a
    // ogni procedura servita dall'handler: nessuna procedura fa try/catch.
    mapDomainErrors,
    onError((error) => {
      console.error(error);
    }),
  ],
});

const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: exposeApiReference
    ? [new OpenAPIReferencePlugin({ schemaConverters: [new ZodToJsonSchemaConverter()] })]
    : [],
  interceptors: [
    // Stessa via della RPC: anche OpenAPI è una via di accesso, stessa
    // semantica di errore.
    mapDomainErrors,
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function handleRequest(req: NextRequest) {
  const { pathname } = new URL(req.url);

  // Il match della rotta viene PRIMA del contesto: createContext interroga il
  // DB per la sessione, e farlo su ogni 404 è lavoro buttato.
  //
  // Il confine è per SEGMENTO di path, non per prefisso di stringa:
  // `startsWith(API_REFERENCE_PREFIX)` da solo accetterebbe anche una futura
  // procedura chiamata ad es. "/api/rpc/api-reference-export".
  const isApiReference =
    pathname === API_REFERENCE_PREFIX || pathname.startsWith(`${API_REFERENCE_PREFIX}/`);
  const isRpc =
    !isApiReference && (pathname === RPC_PREFIX || pathname.startsWith(`${RPC_PREFIX}/`));
  if (!isRpc && !isApiReference) {
    return new Response("Not found", { status: 404 });
  }
  if (isApiReference && !exposeApiReference) {
    return new Response("Not found", { status: 404 });
  }

  // Prima della sessione (createContext interroga il DB) e di qualunque
  // handler: una POST cross-site non deve costare nemmeno la lookup sessione.
  if (!verifyTrustedOrigin(req.method, req.headers, trustedOrigins)) {
    return new Response("Forbidden", { status: 403 });
  }

  let context: Awaited<ReturnType<typeof createContext>>;
  try {
    context = await createContext(req);
  } catch (error) {
    // Gli interceptor onError coprono solo l'esecuzione delle procedure: se
    // salta la costruzione del contesto, senza questo blocco l'errore non
    // comparirebbe da nessuna parte.
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }

  if (isApiReference) {
    const apiResult = await apiHandler.handle(req, {
      prefix: API_REFERENCE_PREFIX,
      context,
    });
    if (apiResult.response) return apiResult.response;
  } else {
    const rpcResult = await rpcHandler.handle(req, {
      prefix: RPC_PREFIX,
      context,
    });
    if (rpcResult.response) return rpcResult.response;
  }

  return new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
