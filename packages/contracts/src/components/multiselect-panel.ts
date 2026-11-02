import { z } from "zod";

import { defineContract } from "../contract";

/**
 * Pannello della Multiselect: l'elenco delle opzioni. `content` (`options` o
 * `empty`) è un asse di rendering, dichiarato in
 * `packages/scripts/src/core/rendering.ts`; `search` è invece una scelta
 * dell'editor (Story 2.37), l'asse che mostra o nasconde la ricerca. La
 * composizione `multiselect` espone lo stesso asse e lo passa al pannello.
 * `searchPlaceholder` ed `emptyLabel` sono facoltativi: il layer compare
 * solo dove il disegno lo mostra.
 */
export const multiselectPanel = defineContract({
  name: "multiselect-panel",
  version: 1,
  axes: [{ name: "search", type: "option", values: ["false", "true"], default: "false" }],
  fields: {
    options: { schema: z.array(z.string()), kind: "content" },
    searchPlaceholder: { schema: z.string().optional(), kind: "content" },
    emptyLabel: { schema: z.string().optional(), kind: "content" },
  },
});
