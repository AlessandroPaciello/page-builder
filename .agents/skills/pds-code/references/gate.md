# GA — Gate

L'ultima voce: il repo, dopo GC e AC, passa tutti i controlli che non hanno bisogno di Penpot. È un gate binario: o è tutto verde, o si riporta il comando che è fallito e il file che lo fa fallire. Nessun «verde parziale».

## Cosa chiami

Dalla root del repo, uno dopo l'altro:

```bash
pnpm check-types
pnpm test
```

`check-types` compila anche i file generati in `packages/ui`: una virgola sbagliata in `styles.ts` o un path sbagliato nello scaffold si vedono qui. `pnpm test` contiene, per questa pipeline:

| Controllo | Dove | Cosa lo rende rosso |
|---|---|---|
| tema nel CSS compilato | `packages/ui/src/styles/theme-in-css.test.ts` | una utility che non usa il token del tema, un `var(--primary)` shadcn, `next/font` |
| contrasto delle coppie di ruolo | `packages/ui/src/styles/theme-contrast.test.ts` | una coppia `X`/`X-foreground` sotto il pavimento (4.5:1; `muted` 3:1, vedi il file) |
| un pacchetto font per famiglia | `packages/ui/src/styles/fonts.test.ts` | una famiglia del tema senza `@fontsource/*` in `packages/tokens/package.json` o senza `@import` in `fonts.css` |
| axe sulle story `@generated` | `packages/ui/src/domains/stories-axe.test.tsx` | una violazione axe in una story generata (nome accessibile, ruolo, landmark) |
| file `@generated` intatti | `packages/scripts/tests/server/generated-files.test.ts` | un hash che non torna (file modificato a mano) o una versione vecchia con hash giusto (avviso) |
| contratti | `packages/contracts/tests/*` | un contratto che non rispetta le regole o un fingerprint non aggiornato |

`pnpm lint` (i confini dei package) gira in CI: se l'utente lo chiede, si aggiunge; non è parte di GA.

## Come lo riporti

Una riga per comando con l'esito, poi — se c'è un rosso — il nome del comando, il test e il file. Per esempio:

- `pnpm check-types` — verde.
- `pnpm test` — **rosso**: `packages/ui/src/styles/theme-contrast.test.ts` → `primary: … = 4.1:1, sotto 4.5:1` (la coppia è `primary`/`primary-foreground`).

Il difetto si corregge alla fonte, non nel test: un contrasto si sistema in Penpot (con `pds-design` TB/TV) e si riporta con ET; un font mancante è un pacchetto da installare; una violazione axe è una cella o uno scaffold da correggere (in Penpot o nel TSX, su richiesta); un hash che non torna è un file rigenerato. Non si commenta un test e non si alza una soglia per far passare il gate.

## Cosa non fai

- Non dichiari verde un giro con un comando fallito, e non salti un controllo perché «non c'entra».
- Non modifichi i test, le soglie o il tema generato per far passare GA.
- Non committi, non fai push e non apri PR: il gate finisce con il report.
- Non scrivi su Penpot: se il rosso è in Penpot, la voce successiva è `pds-design` o ET.
