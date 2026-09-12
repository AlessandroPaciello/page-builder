// @penpot-ds/ui — export pubblico `.`
//
// Questa cartella ospita i componenti GENERATI dalla pipeline
// fixture → ricetta → emitter (AD-11): ogni file sotto i domini porta il
// marker `@generated` con la provenienza (penpotComponentId + fixtureHash) e
// il comando di rigenerazione — si modifica la ricetta o il binding (o si
// riestrae la fixture) e si rigenera, mai edit a mano. Qui si scrive SOLO
// questo barrel, che aggrega i barrel `@generated` dei domini.
//
// Regola di confine assoluta (Spine#AD-3): i componenti in `domains/` non
// conoscono il dominio page-builder e non importano MAI da `editor/`.
// Il confine è difeso dal check bloccante `pnpm lint` in questo package.

export { Badge, type BadgeProps } from "./data-display";
export { Input, type InputProps } from "./inputs";
export { AccordionItem, type AccordionItemProps } from "./layout";
