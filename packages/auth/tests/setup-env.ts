import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

// Le variabili d'ambiente già esportate (CI, shell) vincono sul file `.env`
// di apps/web — stessa convenzione di prisma.config.ts e dei test di @app/db.
const packageRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.resolve(packageRoot, "../../../apps/web/.env"),
  override: false,
});

// I test di Better Auth girano sia in locale sia in CI (dove l'job esporta solo
// DATABASE_URL e SKIP_ENV_VALIDATION=1): qui i valori minimi per un'istanza
// betterAuth() funzionante. Il secret rispetta il minimo di 32 caratteri
// richiesto dalla validazione di @app/env/server.
process.env.BETTER_AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789abcdef";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.CORS_ORIGIN ??= "http://localhost:3000";

// DATABASE_URL NON ha fallback: il test di integrazione richiede un Postgres
// reale e deve fallire chiaramente se manca (nessuno skip silenzioso).
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL non impostata: il test di integrazione richiede un Postgres reale (pnpm db:start da packages/db).",
  );
}
