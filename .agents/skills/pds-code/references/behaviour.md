# GC — Comportamento

Il comportamento accessibile non si genera da Penpot: si aggiunge al `<Comp>.tsx` dello sviluppatore un pezzo alla volta, dopo lo scaffold. Qui si sceglie il pezzo, si legge la fonte, si mostra un diff piccolo e si scrive il test che lo prova. Resta dentro GC, senza una voce nuova nel menu della skill.

## Ingresso

Un componente già generato (GC, passo 2) e una richiesta esplicita di comportamento: una croce che rimuove, un menu che apre e chiude, un focus che torna al trigger. Se il componente non esiste ancora, il comportamento si propone dopo lo scaffold. Non si parte d'ufficio: senza richiesta, o se un cambio di struttura non tocca una parte usata da un comportamento, non si ripropone.

## Le fonti, in quest'ordine

1. **Base UI, se il primitivo esiste.** Il progetto è `headless=base-ui`: se il comportamento ha già il suo primitivo (`Menu`, `Dialog`, `Tabs`, `Checkbox`…), si propone solo il **collegamento** — l'import e le poche righe che usano il primitivo — con il diff e il test. Non si installa niente: Base UI è già una dipendenza del progetto.
2. **La ricetta shadcn `base`, letta dal vivo.** Se un primitivo non c'è, si legge la ricetta del componente dal sito di shadcn (la variante `base`, non `radix`) e si guarda come il comportamento è composto. La ricetta è una fonte da leggere, non un file da copiare: non finisce nel repo.
3. **Il pattern APG, letto dal vivo.** Per ciò che la ricetta non dice — ruoli, tasti, focus, `aria-*` — si legge il pattern di WAI-ARIA Authoring Practices corrispondente. Anche l'APG si legge e non si salva nel repo.

Una fonte che non si trova, o che contraddice `_bmad-output/initiative-page-builder/spec-page-builder/a11y-baseline.md`, è un blocco: si dice all'utente e non si improvvisa.

## Passi

1. **Elenco.** Si legge il componente e si elencano i comportamenti possibili, uno per riga, con la fonte di ognuno (`Base UI: Menu`, `shadcn base: dialog`, `APG: combobox`). Poi si chiede quale si fa, uno alla volta.
2. **Un comportamento, un diff.** Per quello scelto si mostra il diff **piccolo** del `<Comp>.tsx` — solo le righe del comportamento, non il file — e si chiede il sì. Un sì vale per quel diff: se dopo il sì cambia qualcosa, serve un nuovo sì.
3. **Si applica solo il diff approvato.** Il TSX è dello sviluppatore: le modifiche si applicano solo dopo il sì, e solo quelle mostrate. `styles.ts` e la story restano `@generated` e non si toccano.
4. **Un test per comportamento.** Il test va nel file dello sviluppatore accanto al componente (`<Comp>.test.tsx`) e prova il comportamento, non l'aspetto: ruolo e nome accessibile, il click che chiama il callback, `axe` verde sul componente nello stato del comportamento. Per un controllo nativo (`<button>`, `<a>`, `<input>`) basta questo: Enter, Spazio e tabulazione li dà l'elemento scelto, e in jsdom non producono un click. I tasti (`ArrowDown`, `Escape`…) si sparano con `fireEvent`, solo dove il componente li gestisce da sé; il focus che torna al trigger si prova esplicitamente. Niente `jest-dom` né `user-event`: `fireEvent`, `screen`, `axe` da `vitest-axe`, `cleanup`, come `packages/ui/src/editor/dropdown-menu.test.tsx`.
5. **Si esegue.** Il test lo esegue GA (`pnpm test`). Un rosso si riporta con il comando, il file e il test: non si dichiara verde un test che non è stato eseguito.
6. **Si ripropone solo quando serve.** Dopo un cambio di struttura (AC) si ripropone solo se tocca una parte usata da un comportamento; altrimenti si lascia stare.

## Le dipendenze

Se il comportamento chiede una dipendenza nuova (un pacchetto del primitivo, una libreria di test, un helper), la scelta è dell'utente: si mostra la dipendenza, cosa aggiunge, e **l'alternativa senza dipendenze** (per esempio il `<button>` nativo invece di un componente di terze parti). Senza una scelta esplicita non si installa niente.

## Cosa non fai

- Non salvi la ricetta shadcn né il pattern APG nel repo: si leggono dal vivo, ogni volta.
- Non scegli una dipendenza al posto dell'utente e non ne installi una senza il sì.
- Non tocchi `styles.ts`, la story o un altro file `@generated`: il comportamento vive nel `<Comp>.tsx` e nel suo test.
- Non estendi il comportamento a componenti assenti (Badge, ShopCard e Carousel sono della 2.31): qui si lavora solo sul componente dato.
- Non proponi il comportamento senza richiesta, né lo riproponi a ogni giro.
- Non apri una voce nuova nel menu: il comportamento resta dentro GC.
- Non dichiari verde un test che non hai eseguito, e non lo esegui tu al posto di GA.
