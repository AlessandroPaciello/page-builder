# Forged idea — Library Penpot shadcn + esagono Puck

Esito: HARDENED (2026-09-12). Input per `bmad-correct-course`. Dettaglio in `.memlog.md`.

## Lock

**Esagono**
- Il page builder possiede il contratto (assi, valori, parti). Penpot possiede valori e aspetto, non la matrice. → riscrive AD-11.
- Nuovo package `contracts` (Zod props + classifier structure/content + tipi di asse + definizioni di sezione), zero dipendenze da React/Puck/shadcn. Adapter: `ui/domains`, `puck-components`, render pubblico, `core`. → riscrive AD-5.
- Una libreria per installazione, scelta a build time.
- Tipi di asse dichiarati nel contratto: `option` (prop in Puck → stile per variante), `state` (browser → `focus-visible:`/`aria-invalid:`/`disabled:`), `behavior` (headless → `data-[state=…]:`). Penpot li disegna tutti come varianti.

**Pipeline**
- Ricetta = mappa di parti a profondità 1, celle **proprietà → token** (non classi Tailwind). Geometria delle icone ignorata. Parte annidata con assi propri → lo schema fallisce. → adegua `RecipeSchema` (2.2) e sostituisce il criterio di stop della 2.3.
- Un emitter per libreria (shadcn: cva+Tailwind; MUI: `theme.components.*.variants`) + tabella di binding per componente.
- Legame componente→contratto: SharedPluginData sul VariantContainer (`pagebuilder/contract = nome@versione`), nome come controllo incrociato. Fallisce su duplicato, nome incoerente, contratto senza container.
- Pass/fail negli script e negli schemi, mai nel prompt delle skill.
- Skill di scrittura Penpot: bootstrap una tantum, poi solo additiva; deve creare anche i token shadow/ring.

**Sezioni e layout**
- Sezione = albero di dati (blocchi del contratto + props + slot), estratto da Penpot; in Penpot solo istanze di componenti della library + layout.
- Rigida per default: struttura bloccata, contenuto modificabile, aperta solo negli slot dichiarati (allow + max) decisi da sviluppatore/admin.
- Box = solo visivo (background, padding, radius, border); Flex/Grid/Columns = disposizione. Tutti i valori da token. Mapping meccanico dal board Penpot.
- Hero/Section non sono più blocchi scritti a mano: diventano definizioni di sezione. → aggiorna `design-system.md`.
- Componenti complessi (3D, mappe): contratto vero, segnaposto Penpot non estratto, adapter a mano senza `@generated`.

**Sequenza**
- A: contratti (Badge, Input, Accordion) → library Penpot nuova → estrazione con la 2.2 adeguata → 2.3.

## Scartate
- 2.3 subito sulla library attuale — input da buttare (`colorStyle`, varianti identiche), test Accordion rifatto due volte.
- Sync ricorrente codice→Penpot — due sorgenti, conflitto irrisolvibile.
- Tipo dell'asse dichiarato in Penpot — rimette l'ownership a Penpot.
- Hero/Section come blocchi generici + preset — due modi per la stessa cosa.
- Celle in classi Tailwind — legano la ricetta a una sola libreria.

## Verificato
- MCP Penpot: token, varianti, applyToken, switchVariant, SharedPluginData su Badge, Input, AccordionItem ("Nuovo File 4").
- Puck 0.22.4: slot con allow/disallow senza max (→ `resolvePermissions` + validazione server), permessi per componente, `readOnly` per prop, niente template nativi.

## Rischi residui
- Adeguare `RecipeSchema` tocca codice in main con 74+ test.
- Nessun emitter MUI provato: fattibilità dedotta dall'API tema MUI, non eseguita.
- Da fare: installare BMad Builder prima del modulo `penpot-ds`.
