import { carousel, type SectionDefinition } from "@app/contracts";

import type { Cella, Lettura, LetturaLayer } from "../../src/core";
import { layer, SCALE, tokenTypeOf } from "./components";

/**
 * `Lettura` scritte a mano per la sezione Carousel (Story 2.27): la radice con
 * il layer slot `Slides` e tre istanze `ProductCard` di esempio. Gli esempi
 * dello slot non si visitano: sono dati del disegno, non parti.
 */

export const SECTIONS: Readonly<Record<string, SectionDefinition>> = { carousel };

export const SECTION_INPUT = { tokenTypeOf, scale: SCALE, sections: SECTIONS };

/** L'istanza di ProductCard dentro lo slot: un esempio, senza chiave di parte. */
export function slide(n: number): LetturaLayer {
  return layer({
    name: `Slide ${n}`,
    kind: "board",
    style: { sizingH: "fill" },
    instance: { component: "ProductCard", contract: "product-card@1", variant: {}, overrides: [] },
  });
}

/**
 * La radice di una cella: il layer `Slides` (i cui figli sono tutte istanze di
 * `product-card`, quindi lo slot `slides`) e le parti proprie passate in
 * `extra`. `perView=1` è in colonna, gli altri in riga: l'asse cambia le classi.
 */
export function carouselRoot(perView: string, extra: readonly LetturaLayer[] = []): LetturaLayer {
  return layer({
    name: "Carousel",
    kind: "board",
    style: { layoutDir: perView === "1" ? "column" : "row" },
    children: [
      layer({
        name: "Slides",
        kind: "board",
        style: { layoutDir: "row" },
        children: [1, 2, 3].map(slide),
      }),
      ...extra,
    ],
  });
}

/** Le tre celle `perView=1,2,3`; `cells` sostituisce l'intero elenco. */
export function carouselLettura(cells?: Cella[]): Lettura {
  return {
    component: "Carousel",
    pluginData: { contract: "carousel@1" },
    cells:
      cells ?? (["1", "2", "3"] as const).map((perView) => ({ variant: { perView }, root: carouselRoot(perView) })),
  };
}

/** Una sola cella senza alcuna variante: il field `structure` perView resta irrisolto. */
export function carouselSenzaVarianti(): Lettura {
  return carouselLettura([{ variant: {}, root: carouselRoot("3") }]);
}
