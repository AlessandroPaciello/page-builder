import type { AppRouterClient } from "@app/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        toast.error(`Error: ${error.message}`, {
          action: {
            label: "retry",
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * On the server every request gets a fresh cache, otherwise a single
 * module-scope client would leak data between concurrent users.
 * In the browser we reuse one client so state survives re-renders.
 */
export function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }

  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

export const link = new RPCLink({
  url: async () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/rpc`;
    }

    // Dynamic import keeps the server-only env module out of the client bundle.
    const { env } = await import("@app/env/server");
    return `${env.BETTER_AUTH_URL}/api/rpc`;
  },
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
  headers: async () => {
    if (typeof window !== "undefined") {
      return {};
    }

    // Forward only what the RPC call needs to authenticate. Copying every
    // inbound header would carry over content-length/host/connection from the
    // incoming request and corrupt the outbound one.
    const { headers } = await import("next/headers");
    const incoming = await headers();

    const forwarded: Record<string, string> = {};
    for (const name of ["cookie", "authorization"]) {
      const value = incoming.get(name);
      if (value) {
        forwarded[name] = value;
      }
    }
    return forwarded;
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
