import { accordionItem } from "./components/accordion-item";
import { badge } from "./components/badge";
import { input } from "./components/input";
import type { ComponentContract } from "./contract";
import type { SectionDefinition } from "./section";
import { accordion } from "./sections/accordion";

/** Unico punto che elenca i contratti: classifier, fingerprint e test leggono da qui. */
export const COMPONENT_CONTRACTS = {
  [badge.name]: badge,
  [input.name]: input,
  [accordionItem.name]: accordionItem,
} as const satisfies Readonly<Record<string, ComponentContract>>;

/** Unico punto che elenca le definizioni di sezione. */
export const SECTION_DEFINITIONS = {
  [accordion.name]: accordion,
} as const satisfies Readonly<Record<string, SectionDefinition>>;
