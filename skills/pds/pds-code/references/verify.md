# VC — Verifica componente

Legge il componente da Penpot, lo verifica contro il contratto dell'editor e ti dice cosa manca per generarlo: un blocco ferma, una domanda si risponde (e la risposta si scrive in Penpot), un avviso si riporta. È la voce in cui `pds-code` scrive i plugin data `pagebuilder`.

## Ingresso

`name` è il contratto (`badge`, `badge@1`) o il nome del layer in Penpot (`Multiselect Trigger`): la ricerca prova prima il `pagebuilder.contract`, poi il nome del layer. Chiedi quale componente se l'utente non l'ha detto; leggi `packages/contracts/src/registry.ts` per sapere quali contratti esistono.

## Cosa chiami

`verify_component { name }` sul server `pds` (sola lettura; il `<Comp>.tsx` lo legge dal disco). Ogni finding ha `level` (`blocco`, `domanda`, `avviso`), `where` e `message`; una `domanda` porta anche `key` e `options`.

`describe_component { name }` serve quando devi mostrare il contesto o rileggere una risposta: restituisce `pluginData` del container e dei layer e le celle lette.

## Come lo mostri

Una tabella, nell'ordine che conta:

| Livello | Dove | Cosa | Opzioni |
|---|---|---|---|
| blocco | cella / parte | il messaggio così com'è | — |
| domanda | layer | il messaggio | le `options`, e con quale `key` si risponde |
| avviso | cella / parte | il messaggio | — |

Poi il riepilogo: blocchi, domande aperte, avvisi. Le celle mancanti non sono un finding: se una combinazione dell'editor non è disegnata, aggiungila come nota (le celle le disegna `pds-design` DC).

## Il contratto mancante

Se il solo blocco è «manca il contratto», il container non ha `pagebuilder.contract`: senza, il nucleo non analizza chiavi, doppioni e assi, e non si genera niente.

1. Proponi `nome@versione`: il nome è il contratto che risponde a quel layer (`packages/contracts/src/registry.ts`, con il nome del layer in kebab se serve), la versione è il campo `version` di `packages/contracts/src/components/<nome>.ts` (o `sections/<nome>.ts`).
2. Se il nome **non è nel registro**, fermati: il contratto non esiste e non si inventa. Manda a `pds-design` CN (contratto nuovo) o CD (contratto dal design); la risposta è una frase, non una scrittura.
3. Anteprima: layer (id e nome), chiave `contract`, valore `nome@versione`. Poi il sì. Poi la scrittura (`references/answers.md`).
4. Rileggi con `describe_component` e mostra `pluginData.contract`. Rilancia `verify_component`: ora arrivano chiavi, doppioni e assi.

## Le domande, una per volta

Per ogni `domanda`, in ordine:

1. Mostra `where`, il messaggio e **tutte** le `options`, con cosa fa ognuna quando non è ovvio (`ignora` fonde il layer e perde le classi; `lista` contro `parte-nuova`).
2. L'utente sceglie. Per `part` la proposta è solo una proposta: vale anche un'altra chiave kebab, mostrata nell'anteprima (serve quando il nucleo blocca «la stessa chiave compare in rami diversi: cambia la chiave»). Per le altre chiavi una risposta fuori elenco non si scrive: il nucleo la tratta come blocco.
3. Trova il layer con `execute_code` (`references/answers.md`), mostra l'anteprima — layer, `key`, valore — e chiedi il sì.
4. Scrivi, rileggi con `describe_component`, mostra la chiave letta.
5. Rilancia `verify_component` e passa alla domanda successiva: una risposta può aprirne un'altra (`parte-nuova` lascia aperta la domanda `part` per la chiave nuova).

Non rispondere a più domande con un sì solo: un sì vale per la scrittura mostrata. L'eccezione è lo stesso layer ripetuto nelle celle: stesso nome, stessa `key`, stesse `options` è una domanda sola, con tutti gli id nell'anteprima (`references/answers.md`, § Regole).

## Gli avvisi

Si riportano, non si correggono: una misura fuori scala, un vincolo non traducibile, una parte esportata e non usata. Dopo GC l'avviso di parte inutilizzata arriva dal `<Comp>.tsx` che esiste: prima di GC non c'è, ed è normale.

## Cosa non fai

- Non scrivi chiavi che non siano nella tabella di `references/answers.md`, e mai stile, geometria, layer o token.
- Non scrivi un `contract` che non è nel registro, e non ne inventi la versione.
- Non «sistemi» il disegno (layer, nomi, celle) per far sparire un finding: quello è `pds-design`.
- Non generi codice: `build_order` e `generate_component` sono GC.
