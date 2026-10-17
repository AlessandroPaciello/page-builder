// @penpot-ds/ui — export pubblico `.`
//
// Vuoto dalla Story 2.18: i cinque componenti di prova della v2 sono stati
// rimossi con la pipeline che li generava. I componenti tornano qui con la v3 (Story 2.31): `<Comp>.tsx`
// dello sviluppatore accanto a `<Comp>.styles.ts` e `<Comp>.stories.tsx`
// `@generated`, e questo barrel li riesporta.
//
// Regola di confine assoluta (Spine#AD-3): i componenti in `domains/` non
// conoscono il dominio page-builder e non importano MAI da `editor/`.
// Il confine è difeso dal check bloccante `pnpm lint` in questo package.

export {};
