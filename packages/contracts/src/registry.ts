import { accordionItem } from "./components/accordion-item";
import { alert } from "./components/alert";
import { badge } from "./components/badge";
import { input } from "./components/input";
import { productCard } from "./components/product-card";
import type { ComponentContract } from "./contract";
import type { SectionDefinition } from "./section";
import { accordion } from "./sections/accordion";

/**
 * Unico punto che elenca i contratti: classifier, fingerprint e test leggono
 * da qui. Tutti i contratti sono ridotti (v2, solo assi `option`): stanno
 * interamente nel fingerprint, senza estensioni fuori fingerprint.
 */
export const COMPONENT_CONTRACTS = {
  [badge.name]: badge,
  [input.name]: input,
  [accordionItem.name]: accordionItem,
  [alert.name]: alert,
  [productCard.name]: productCard,
} as const satisfies Readonly<Record<string, ComponentContract>>;

/** Unico punto che elenca le definizioni di sezione. */
export const SECTION_DEFINITIONS = {
  [accordion.name]: accordion,
} as const satisfies Readonly<Record<string, SectionDefinition>>;
