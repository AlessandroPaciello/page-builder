import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    // `requireAuth` ha già scartato le sessioni assenti: l'optional chaining
    // riaprirebbe nel tipo di ritorno un caso che il middleware ha escluso.
    return {
      message: "This is private",
      user: context.session.user,
    };
  }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
