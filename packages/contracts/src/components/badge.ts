import { z } from "zod";

import { defineContract } from "../contract";

export const badge = defineContract({
  name: "badge",
  version: 1,
  axes: [
    { name: "variant", type: "option", values: ["default", "secondary", "destructive"], default: "default" },
    { name: "size", type: "option", values: ["sm", "md"], default: "md" },
  ],
  parts: ["root", "label"],
  partRoles: { root: "surface", label: "text" },
  fields: {
    label: { schema: z.string(), kind: "content" },
  },
});
