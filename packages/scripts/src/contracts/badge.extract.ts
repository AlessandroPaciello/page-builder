import { badge } from "@app/contracts";

import { defineExtraction } from "../extraction";

/**
 * Contratto di estrazione del Badge (Story 2.16, CAP-11): rinasce dalla v2
 * come gli altri tre, dai file v1 cancellati (judgment + binding letti dalla
 * storia git: dominio `data-display`, 2 parti, assi `variant`/`size` option,
 * nessuna parte condizionale, nessuna ripetizione, headless null).
 *
 * Celle attese = `variant × size` = 6. Il layout (`flex`, `items-center`,
 * `gap-*`) arriva dal layer Penpot (registro `layoutDir`/`layoutAlign`/gap),
 * mai da classi scritte a mano (decisione BADGE-LAYOUT dello SPEC).
 */
export const badgeExtraction = defineExtraction(badge, {
  penpot: { container: "Badge" },
  render: { domain: "data-display", headless: null },
  parts: {
    root: { role: "surface", element: "span" },
    label: { role: "text", element: "span", parent: "root", content: "label" },
  },
  a11y: { role: null, focusVisible: false },
});

export default badgeExtraction;
