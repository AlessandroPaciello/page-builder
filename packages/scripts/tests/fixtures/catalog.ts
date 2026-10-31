import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { TokenCatalog } from "../../src/shared/theme-generator";

/**
 * Catalogo token Tailwind per i test di `scripts` (Story 2.19, bug 14).
 *
 * `tailwind-catalog.json` è scritto come dati, non letto da Penpot: contiene i
 * set `tailwind` (palette e scale di Tailwind v4) e `semantic` (ruoli shadcn
 * come riferimenti alla palette) del seme dello spike
 * (`_bmad-output/spikes/penpot-ai-kit-2026-10-10/tailwind-to-penpot/tokens.json`,
 * ricavato da `theme.css`), convertiti nella forma `TokenCatalog`
 * (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`). Il set
 * `brand/ocean` resta fuori: ridefinisce gli stessi ruoli di `semantic` — il
 * giro completo con le varianti (set + temi) passa da `tokensFromCss` sul
 * seme (`tests/fixtures/seed-theme.css`) e da `extractTheme`. Il seme ha già
 * lasciato fuori (`skipped`) i passi frazionari della spaziatura,
 * `--font-serif`, `--font-mono` e i breakpoint, e ha portato i colori fuori
 * sRGB (`clampedColors`) al più vicino in hex.
 *
 * `generateTheme` (che genera la base, senza varianti) è testato anche contro
 * `penpot-catalog.json` (la library "mis", solo dati di test).
 */
export const TAILWIND_CATALOG_PATH = fileURLToPath(new URL("./tailwind-catalog.json", import.meta.url));

/** Una copia nuova a ogni chiamata: un test che la modifica non sporca gli altri. */
export function loadTailwindCatalog(): TokenCatalog {
  const catalog = JSON.parse(readFileSync(TAILWIND_CATALOG_PATH, "utf8")) as TokenCatalog;
  if (!catalog || !Array.isArray(catalog.sets) || catalog.sets.some((set) => typeof set?.name !== "string" || !Array.isArray(set.tokens))) {
    throw new Error(`Fixture malformata: ${TAILWIND_CATALOG_PATH} non ha la forma { sets: [{ name, tokens[] }] }.`);
  }
  return catalog;
}
