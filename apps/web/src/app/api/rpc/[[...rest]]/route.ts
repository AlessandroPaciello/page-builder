import { createContext } from "@app/api/context";
import { appRouter } from "@app/api/routers/index";
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

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
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
