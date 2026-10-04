import { alert } from "@app/contracts";

import { defineExtraction } from "../extraction";

/**
 * Contratto di estrazione dell'Alert (Story 2.16, CAP-11): dai file v1
 * cancellati (judgment + binding dalla storia git: dominio `feedback`,
 * headless null, 3 parti, asse `status` option con 4 valori). Il `role` ARIA
 * è per variante (`info`/`success` → `status`, `warning`/`error` → `alert`),
 * emesso dal render per valore di `status` (decisione ALERT-ROLE dello SPEC).
 *
 * Celle attese = `status` = 4. Parti: `root` (`surface`, `div`), `heading` e
 * `description` (`text`, `div`, contenuto dai field omonimi).
 */
export const alertExtraction = defineExtraction(alert, {
  penpot: { container: "Alert" },
  render: { domain: "feedback", headless: null },
  parts: {
    root: { role: "surface", element: "div" },
    heading: { role: "text", element: "div", parent: "root", content: "heading" },
    description: { role: "text", element: "div", parent: "root", content: "description" },
  },
  a11y: {
    role: { info: "status", success: "status", warning: "alert", error: "alert" },
    focusVisible: false,
  },
});

export default alertExtraction;
