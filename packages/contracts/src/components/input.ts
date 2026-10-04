import { z } from "zod";

import { defineContract } from "../contract";

/**
 * Input ridotto (Story 2.16, v2): gli stati (`default`, `focus`, `error`,
 * `disabled`) sono assi di RENDERING (`state`) nel contratto di estrazione
 * (`packages/scripts/src/contracts/input.extract.ts`) e non producono prop.
 */
export const input = defineContract({
  name: "input",
  version: 1,
  axes: [],
  fields: {
    placeholder: { schema: z.string(), kind: "content" },
  },
});
