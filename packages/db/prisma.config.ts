import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Il path va risolto rispetto a QUESTO file, non alla cwd: `prisma migrate`
// lanciato dalla root del monorepo non trovava nulla e falliva in silenzio
// (dotenv non protesta se il file non esiste).
const packageRoot = path.dirname(fileURLToPath(import.meta.url));

// `.env` vive in apps/web perché è lì che Next lo carica. Il layer DB lo legge
// come consumatore: la variabile d'ambiente, se già presente (CI, Docker,
// `pnpm db:*` con env esportato), vince sul file.
dotenv.config({
  path: path.resolve(packageRoot, "../../apps/web/.env"),
  override: false,
});

export default defineConfig({
  schema: path.join(packageRoot, "prisma", "schema"),
  migrations: {
    path: path.join(packageRoot, "prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
