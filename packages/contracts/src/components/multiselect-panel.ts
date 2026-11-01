import { z } from "zod";

import { defineContract } from "../contract";

/**
 * Pannello della Multiselect: l'elenco delle opzioni. **Senza assi** nel
 * contratto: `content` (`options` o `empty`) è un asse di rendering, dichiarato
 * in `packages/scripts/src/core/rendering.ts`, e `search` resta fuori (Story
 * 2.35). `searchPlaceholder` ed `emptyLabel` sono facoltativi: il layer compare
 * solo dove il disegno lo mostra.
 */
export const multiselectPanel = defineContract({
  name: "multiselect-panel",
  version: 1,
  axes: [],
  fields: {
    options: { schema: z.array(z.string()), kind: "content" },
    searchPlaceholder: { schema: z.string().optional(), kind: "content" },
    emptyLabel: { schema: z.string().optional(), kind: "content" },
  },
});
