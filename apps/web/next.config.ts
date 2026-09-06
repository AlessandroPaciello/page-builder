import "@app/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Envelope operativo dello Spine: deploy container Docker self-host. Il
  // runner standalone (apps/web/.next/standalone/apps/web/server.js) contiene
  // solo ciò che il file-tracing traccia: niente prisma.config.ts, niente CLI —
  // le migration girano in un container separato (Dockerfile stage builder).
  output: "standalone",
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
