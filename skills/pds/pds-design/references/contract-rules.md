# Contratti: forma, registrazione, versioni

Il contratto dell'editor è l'unico file per componente (AD-1, AD-11 v3): assi `option`, field, slot. Tutto il resto — parti, albero, istanze, celle, token, geometria — si legge da Penpot; elemento HTML, comportamento e a11y stanno nel componente dello sviluppatore. Vale per CN, CD e MS.

## Dove

| Cosa | File |
|---|---|
| componente (nessuno slot) | `packages/contracts/src/components/<nome>.ts` |
| sezione (almeno uno slot) | `packages/contracts/src/sections/<nome>.ts` |
| elenco unico | `packages/contracts/src/registry.ts` (`COMPONENT_CONTRACTS`, `SECTION_DEFINITIONS`) |
| versione dello schema | `packages/contracts/src/schema-version.ts` |
| hash del fingerprint | `packages/contracts/tests/contracts.fingerprint.json` (append-only per le versioni rilasciate) |

## Forma

```ts
import { z } from "zod";

import { defineContract } from "../contract";

export const alert = defineContract({
  name: "alert",
  version: 1,
  axes: [{ name: "status", type: "option", values: ["info", "success", "warning", "error"], default: "info" }],
  fields: {
    heading: { schema: z.string(), kind: "content" },
    description: { schema: z.string(), kind: "content" },
  },
});
```

Una sezione è `SectionDefinition` (vedi `sections/carousel.ts`): `fields` propri, `root` con `id: "root"`, `component` uguale al nome della sezione, `props` con il default di ogni field, `children` di esempio (i figli di default della story), `slots: [{ id, allow, max? }]`.

Regole verificate a module load da `defineContract` (messaggio che nomina contratto e campo):

- `name` kebab-case (`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`), `version` intero ≥ 1.
- Solo assi `option`. Gli assi di rendering — `state` e quelli dichiarati nella tabella `packages/scripts/src/core/rendering.ts` (`open`, `display`, `removable`, `checked`, `content`) — vivono in Penpot e in `packages/scripts`, non nel contratto: non sono scelte dell'editor e non producono prop.
- Nessun nome duplicato (assi, valori di un asse); `default` deve stare tra i `values`.
- Nomi di assi e field: `IDENTIFIER` = `/^[a-z][a-zA-Z0-9]*$/` — comincia con una minuscola, poi lettere e cifre, **camelCase ammesso** (`searchPlaceholder`, `emptyLabel`). Diversi da un campo omonimo, da un attributo HTML globale (`title`, `id`, `class`, `slot`, `part`, …) e dalle prop riservate di React (`role`, `children`, `key`, `ref`, `value`, `on…`). Per il titolo di un testo si usa `heading`, non `title`.
- Ogni field ha uno schema Zod rappresentabile come JSON schema (string, number, boolean, enum, url, array, object): i field obbligatori sono il default e restano obbligatori anche dove il disegno non mostra la parte (lo stato vuoto è un valore: `[]` per le liste, `""` per un testo). `.optional()` solo per un'etichetta che il componente può non avere affatto (un layer che compare come variante di resa) e in quel caso chiedilo. La rappresentabilità la controlla il fingerprint (`z.toJSONSchema`), non `defineContract` al module load: l'errore arriva da `pnpm --filter @app/contracts test`.
- `kind`: `structure` è una scelta che cambia il disegno — l'editor non la lascia cambiare a chi non è amministratore, e un asse `option` è `structure` d'ufficio; un field `structure` con lo stesso nome di una proprietà di variante in Penpot diventa l'asse delle celle. `content` è ciò che l'editor scrive e il server sanitizza.

Una sezione passa anche da `validateSectionDefinition` (in `section.test.ts`): nome kebab-case e diverso da ogni contratto di componente, `root` valido, slot con id univoco, `allow` che nomina contratti esistenti.

## Scrivere (dopo il sì)

1. **Elenca ogni file che scriverai**, prima del sì: il contratto (o i contratti, figli-prima), `packages/contracts/src/registry.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/schema-version.ts`, `packages/contracts/tests/contracts.fingerprint.json` con la voce nuova, `packages/contracts/tests/components.test.ts` (il test del contratto e del registry) e — solo per una sezione — l'elenco scritto a mano in `packages/contracts/tests/section.test.ts`. Un file che non era nell'elenco **non si scrive**; un file che cambia dopo il sì (anche un solo valore) richiede un **nuovo sì** su ciò che è cambiato. Il sì copre l'elenco, non «il resto».
2. Scrivi il contratto, aggiungilo al registry con la chiave uguale a `name` e all'`index.ts` con l'export.
3. In `schema-version.ts`: `SCHEMA_VERSION` + 1 e una riga di commento che dice cosa entra (`* 6 (Story …): entra …`).
4. Aggiungi la voce del fingerprint: `pnpm --filter @app/contracts test` fallisce e il messaggio stampa l'hash attuale («Manca la voce "<n>" … (hash attuale: <hash>)»); incolla `"<n>": "<hash>"` in `tests/contracts.fingerprint.json`. Il file è **append-only per le versioni rilasciate**: una voce di una `SCHEMA_VERSION` mai rilasciata (è il caso della 6 in questo branch) si **riscrive** con l'hash corrente, e lo dici nel sì; da qui in avanti le voci rilasciate non si riscrivono mai.
5. Riverifica: `pnpm --filter @app/contracts test` verde, poi `pnpm check-types` e `pnpm lint` dalla root.

## Regola A (`nome@versione`)

- Un cambio **compatibile** (valori d'asse aggiunti, field aggiunti) alza solo `SCHEMA_VERSION`: `version` non si tocca e il plugin data in Penpot resta valido. Aspetto, parti e assi di rendering non sono nel contratto: si cambiano in Penpot e non muovono il fingerprint.
- Un cambio **incompatibile** (rinomina o rimozione di un valore o di un field che una pagina salvata può usare) alza anche `version` di 1. Il plugin data `pagebuilder/contract = nome@versione` va riallineato in Penpot: lo fa `pds-code` con conferma, mai `pds-design`. Finché non è fatto, `verify_component` dà un blocco di versione — è il segnale per `pds-code`, non un motivo per scrivere tu il dato.

## Cosa non fai

- Non scrivi `parts`, `partRoles` né assi di rendering nel contratto: non sono il vocabolario dell'editor (gli assi di rendering vivono in `packages/scripts/src/core/rendering.ts`).
- Non crei file per componente fuori dal contratto; nessun metadato per componente.
- Non tocchi i file `@generated` (`packages/ui/src/domains/**`, `packages/tokens/src/**`), `packages/scripts`, `_bmad/`.
- Non registri un contratto «per prova»: se non c'è un componente reale da disegnare, non è CN.
