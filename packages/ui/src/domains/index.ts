// @penpot-ds/ui — export pubblico `.`
//
// Questa cartella ospita i componenti GENERATI dalla pipeline
// due contratti → istantanea → render (AD-11 v2): ogni file sotto i domini
// porta il marker `@generated` con la provenienza (contract, penpotComponentId,
// snapshotHash) e il comando di rigenerazione — si modifica il contratto di
// estrazione o il registro (o si riestrae) e si rigenera, mai edit a mano.
// Qui si scrive SOLO questo barrel, che aggrega i barrel `@generated` dei domini.
// (Story 2.16: v1 cancellata, Badge → Input → Alert → AccordionItem ultimo
// rigenerati uno alla volta via extract+render dalla v2, diff zero.)
//
// Regola di confine assoluta (Spine#AD-3): i componenti in `domains/` non
// conoscono il dominio page-builder e non importano MAI da `editor/`.
// Il confine è difeso dal check bloccante `pnpm lint` in questo package.

export { Badge, type BadgeProps } from "./data-display";
export { Input, type InputProps } from "./inputs";
export { AccordionItem, type AccordionItemProps } from "./layout";
export { Alert, type AlertProps } from "./feedback";
export { ProductCard, type ProductCardProps } from "./commerce";
