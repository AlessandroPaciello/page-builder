import { accordionItem } from "./components/accordion-item";
import { alert } from "./components/alert";
import { badge } from "./components/badge";
import { checkbox } from "./components/checkbox";
import { chip } from "./components/chip";
import { input } from "./components/input";
import { multiselect } from "./components/multiselect";
import { multiselectPanel } from "./components/multiselect-panel";
import { multiselectTrigger } from "./components/multiselect-trigger";
import { option } from "./components/option";
import { shopCard } from "./components/shop-card";
import type { ComponentContract } from "./contract";
import type { SectionDefinition } from "./section";
import { accordion } from "./sections/accordion";
import { carousel } from "./sections/carousel";

/**
 * Unico punto che elenca i contratti: classifier, fingerprint e test leggono
 * da qui. Tutti i contratti sono ridotti (v2, solo assi `option`): stanno
 * interamente nel fingerprint, senza estensioni fuori fingerprint. I contratti
 * annidati della Multiselect (`multiselect-trigger`, `multiselect-panel`,
 * `chip`, `option`, `checkbox`) restano componenti della pipeline: nell'editor
 * la Multiselect è un blocco solo.
 */
export const COMPONENT_CONTRACTS = {
  [badge.name]: badge,
  [input.name]: input,
  [multiselect.name]: multiselect,
  [multiselectTrigger.name]: multiselectTrigger,
  [multiselectPanel.name]: multiselectPanel,
  [chip.name]: chip,
  [option.name]: option,
  [checkbox.name]: checkbox,
  [accordionItem.name]: accordionItem,
  [alert.name]: alert,
  [shopCard.name]: shopCard,
} as const satisfies Readonly<Record<string, ComponentContract>>;

/** Unico punto che elenca le definizioni di sezione. */
export const SECTION_DEFINITIONS = {
  [accordion.name]: accordion,
  [carousel.name]: carousel,
} as const satisfies Readonly<Record<string, SectionDefinition>>;
