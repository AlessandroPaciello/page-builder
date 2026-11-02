# Risposte alle domande — plugin data `pagebuilder`

È l'unico posto in cui `pds-code` scrive su Penpot. Ogni risposta è una **shared** plugin data nel namespace `pagebuilder` sul layer che la domanda nomina (`where`), scritta con `execute_code` del server `penpot`. Prima l'anteprima (layer, chiave, valore), poi il sì, poi la scrittura, poi la rilettura.

## La tabella

| Domanda (`key`) | Dove | Valori ammessi | Effetto |
|---|---|---|---|
| `contract` | container del componente (o della sezione) | `nome@versione` del registro | chiude il blocco «manca il contratto»; senza, `verify_component` non analizza chiavi e doppioni |
| `part` | layer senza chiave | il kebab proposto (es. `etichetta`), `ignora`, oppure un'altra chiave kebab scelta dall'utente | la parte prende `data-slot`; `ignora` fonde il layer nel genitore e **le sue classi vanno perse**; un'altra chiave serve quando la stessa chiave compare in rami diversi (blocco del nucleo: «cambia la chiave») |
| `repeat` | layer la cui chiave è già di un fratello | `lista` \| `parte-nuova` | `lista`: la parte si ripete (un `.map` nel TSX, una `cva` sola); `parte-nuova`: resta aperta la domanda `part` per la chiave nuova |
| `element` | parte con nome da titolo, solo quando il `<Comp>.tsx` non esiste | `h2` \| `h3` \| `p` | l'elemento che lo scaffold crea |
| `slot` | layer di sezione i cui figli sono tutti istanze e più slot li ammettono | gli id degli slot candidati | il layer diventa quello slot; i figli sono esempi, non parti |
| `asse.<field>` | container di sezione, field `structure` non disegnato come variante | `asse` \| `content` | `content`: il field non guida il disegno (resta `content`); `asse`: resta aperta, si disegnano le celle con `pds-design` DC |
| `fillInHugH` / `fillInHugV` | layer `fill` dentro un genitore hug sullo stesso asse | `fill` \| `hug` | `fill`: classi di riempimento; `hug`: nessuna classe |
| `overflow` | layer con *clip* attivo, niente esce ma un discendente ha contenuto variabile (testo, immagine, slot) | `hidden` \| `visible` | `hidden`: `overflow-hidden` (taglia anche l'anello di focus); `visible`: niente |
| `when` | parte che esiste solo per un certo valore di un field, **in tutte le celle in cui compare** | il nome di un field del contratto | lo scaffold avvolge la parte in `{field ? (…) : null}` |

`when` non è una domanda di `verify_component`: la scrivi quando la decisione — «questa parte esiste solo con `removable`» — è dell'utente, non del disegno. Un valore che non è un field del contratto (un asse, un valore, un refuso) è un **blocco** del nucleo, non una risposta valida. Va scritto **uguale sulla stessa parte in ogni cella in cui compare**: una cella con `when` e una senza, o con un valore diverso, è un blocco del nucleo. L'anteprima elenca quindi tutti gli id di quella parte nelle celle e un sì li scrive tutti con lo stesso valore, come per il layer ripetuto (§ Regole).

## Trovare il layer (sola lettura)

`verify_component` dà `where` (il nome del layer e la parte), non l'id. L'id si legge con `execute_code` e si mostra nell'anteprima: è quello che rende la scrittura precisa.

```js
const page = penpot.currentPage;
const pathOf = (shape) => {
  const parts = [];
  for (let s = shape; s && s.type !== "page"; s = s.parent) parts.unshift(s.name);
  return parts.join(" / ");
};
const found = page.findShapes({ name: "<nome del layer da where>" });
return found.map((shape) => ({
  id: shape.id,
  name: shape.name,
  path: pathOf(shape),
  parent: shape.parent ? shape.parent.name : null,
  pluginData: Object.fromEntries(
    (shape.getSharedPluginDataKeys("pagebuilder") || []).map((key) => [key, shape.getSharedPluginData("pagebuilder", key)]),
  ),
}));
```

Se `findShapes` restituisce più di un layer, l'anteprima mostra il `path` e l'utente sceglie: non si indovina. Se il layer non c'è, la lettura è vecchia — rifai `verify_component` prima di scrivere.

## Scrivere (dopo il sì)

Una chiave per chiamata, il valore esattamente come mostrato.

```js
const shape = penpot.currentPage.getShapeById("<id>");
if (!shape) return { error: "layer non trovato" };
shape.setSharedPluginData("pagebuilder", "<chiave>", "<valore>");
return {
  id: shape.id,
  name: shape.name,
  value: shape.getSharedPluginData("pagebuilder", "<chiave>"),
};
```

Per togliere una chiave si scrive il valore vuoto: `shape.setSharedPluginData("pagebuilder", "<chiave>", "")`.

La rilettura che conta è quella del server: `describe_component { name }` restituisce `pluginData` del container e di ogni layer (tutte le chiavi stringa non vuote del namespace). Mostra la chiave letta; se non c'è, la scrittura non è andata a buon fine e non si va avanti.

## Regole

- Solo il namespace `pagebuilder`, solo **shared** plugin data (`setSharedPluginData`), mai `setPluginData`.
- Solo le chiavi della tabella. Stile, geometria, nomi dei layer, celle e token non si scrivono: sono del disegno e della lettura.
- Una chiave che non è nelle `options` della domanda non si scrive, anche se sembra sensata: il nucleo la tratta come blocco. L'eccezione è `part`: la proposta è solo una proposta, e vale qualsiasi chiave kebab (una chiave non valida fa ripetere la domanda). Anche la chiave nuova si mostra nell'anteprima come ogni altra scrittura.
- Un sì vale per il layer, la chiave e il valore mostrati. Se dopo il sì cambia uno dei tre, serve un nuovo sì.
- **Lo stesso layer in più celle è una domanda sola.** Il nucleo ripete la domanda per ogni cella (un componente con 24 celle dà 24 domande `part` sullo stesso `Trigger`). Una decisione è: stesso componente, stesso nome di layer, stessa `key`, stesse `options`. L'anteprima elenca tutti gli id (con la cella), un sì li scrive tutti con lo stesso valore, una chiamata per layer. Layer con lo stesso nome ma `options` diverse restano domande distinte.
- **Dopo un'operazione di Penpot che può cancellare i plugin data** — raggruppa, booleana, copia tra file, ripristino di versione, stacco dell'istanza, duplica — rileggi con `describe_component` prima di fidarti: le chiavi possono essere sparite o essere rimaste solo su una parte. L'esito della misura è in `packages/scripts/collaudo/README.md`.
- **Precondizione delle scritture.** La tabella § *Operazioni che cancellano i plugin data* del README del collaudo dev'essere misurata sulla versione di Penpot in uso (oggi 2.18.3, misurata il 2026-11-02); se dice «da misurare», le scritture restano sulla copia del campione nell'istanza di collaudo, mai sul file vero. Dopo una booleana, un gruppo o un duplicato rileggi con `describe_component`: il layer nuovo non ha chiavi.
- **Togliere una chiave.** `setSharedPluginData("pagebuilder", key, "")`: la chiave resta elencata con valore vuoto e il lettore la ignora.
