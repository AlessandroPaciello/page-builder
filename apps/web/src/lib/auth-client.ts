import { env } from "@app/env/web";
import { createAuthClient } from "better-auth/react";

// Senza baseURL il client parla solo same-origin: l'app non sarebbe servibile
// da un dominio diverso da quello delle API.
export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
});
