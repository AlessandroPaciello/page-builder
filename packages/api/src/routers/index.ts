import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { notesRouter } from "./notes";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    // `requirePrincipal` ha già scartato i principal assenti (e con loro le
    // sessioni assenti): l'optional chaining riaprirebbe nel tipo di ritorno
    // un caso che il middleware ha escluso.
    return {
      message: "This is private",
      user: context.session.user,
    };
  }),
  notes: notesRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
