---
name: "pds-code"
description: "Porta in codice tema e componenti del page builder da Penpot: estrae il tema, verifica e genera i componenti, riallinea gli stili, esegue il gate. Use only when explicitly invoked as 'pds-code' (or /pds-code), or when the user says 'estrai il tema', 'verifica il componente', 'genera il componente', 'riallinea gli stili', 'gate finale', 'rispondi alle domande', or picks a voice code (ET, VC, GC, AC, GA). Generic Penpot requests are the kit's penpot-* skills."
---

# pds-code

Porta in codice ciò che è in Penpot: il tema in `packages/tokens/src`, i componenti in `packages/ui/src/domains`, e risponde alle domande del nucleo scrivendo la risposta in Penpot. È la sorella di `pds-design`: là si disegna, qui si genera. I file `@generated` li scrivono gli strumenti del server `pds` — `extract_theme` e `generate_component` — mai tu; il `<Comp>.tsx` dello sviluppatore è suo, e non si tocca senza richiesta. La barra è la fedeltà: nessun valore inventato, nessuna classe persa in silenzio, nessuna scrittura senza un sì esplicito.

## Resolution rules

- Bare paths and `{skill-root}` (e.g. `references/verify.md`) resolve from this skill's installed directory.
- `{project-root}` → the project working directory.
- `{skill-name}` → the skill directory's basename.

## Su cosa non si transige

- **Mai un file `@generated` a mano.** `theme.css`, `themes/*.css`, `fonts.css`, `tokens.generated.ts` li scrive `extract_theme`; `<Comp>.styles.ts` e `<Comp>.stories.tsx` li scrive `generate_component`. Tu leggi, mostri e lanci gli strumenti; se un file è sbagliato, si corregge in Penpot e si rigenera. Un file con il marker `@generated` modificato a mano è un blocco del gate, non una scorciatoia.
- **Plugin data: solo le chiavi del contratto di risposta.** Scrivi `contract`, `part`, `repeat`, `element`, `slot`, `when`, `asse.<field>`, `fillInHugH`/`fillInHugV`, `overflow`. Mai stile, geometria, layer, nomi, celle o token: quelli li legge la pipeline, non li scrive. La tabella completa è in `references/answers.md`.
- **Una conferma per ogni scrittura mostrata**, su Penpot come sui file. Prima l'anteprima — layer (id e nome), chiave, valore, oppure i file che lo strumento scriverà — poi il sì. Un sì vale per ciò che hai mostrato, non per una chiave o un file aggiunti dopo: se qualcosa cambia dopo il sì, serve un nuovo sì.
- **Una domanda per volta, con le sue opzioni.** Le `options` di un finding `domanda` sono le risposte ammesse. L'unica eccezione è `part`: la proposta è una proposta, e vale anche un'altra chiave kebab scelta dall'utente (mostrata nell'anteprima come ogni scrittura). Per le altre chiavi (`repeat`, `element`, `slot`, `asse.<field>`, `fillInHugH`/`fillInHugV`, `overflow`) una risposta fuori elenco è un blocco del nucleo. Dopo la scrittura si rilegge con `describe_component`: la risposta è quella che Penpot restituisce, non quella che hai scritto.
- **GC rispetta `build_order`.** Un componente si genera dopo quelli che contiene; con un blocco di `build_order` ci si ferma, non si sceglie un ordine a mano.
- **Il giudizio è umano.** Dopo GC la story si guarda in Storybook; «testo + colore» è una voce fissa del giudizio (nessuno stato che cambi solo di colore). Nessuno score automatico sostituisce l'occhio.
- **Il TSX dello sviluppatore non si tocca senza richiesta.** Un cambio di struttura produce `suggestions` con un esempio: si mostrano come diff e si applicano solo se l'utente lo chiede.
- **Trigger.** Questa skill parte solo su invocazione esplicita o su una delle frasi qui sopra. «Porta il tema in Penpot», «disegna il componente», «aggiungi un asse» sono di `pds-design`; una richiesta generica a Penpot è del kit (`penpot-router`, `penpot-foundations`).

## On activation

1. Leggi `{project-root}/_bmad/config.yaml`, sezione `pds`. Deve avere `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource`. Se manca o è diversa, fermati **prima di ogni scrittura** e chiedi di eseguire `pds-setup`: la pipeline non implementa altri valori.
2. Controlla i due server MCP di `{project-root}/.mcp.json`: `pds` (stdio; gli strumenti che ti servono — `describe_component`, `verify_component`, `build_order`, `generate_component`, `extract_theme`) e `penpot` (`http` su `http://localhost:9001/mcp/stream`, su cui esegui `execute_code`). Se il client non registra `pds` la skill non può leggere Penpot né scrivere file: **fermati e dillo**, senza indicare un reconnect che non esiste. Se `pds` è registrato ma non risponde, la via è `/mcp` → `pds` → reconnect (dopo una modifica del nucleo o del server il processo va riavviato), e intanto fermati.
3. Chiedi conferma che il plugin MCP sia connesso al file Penpot aperto (File → Plugins → MCP Server → Connect) e che la scheda resti visibile: a scheda sospesa il plugin si ferma.
4. **Una sola lettura** per mostrare lo stato: se l'utente ha già dato un componente, `verify_component { name }` (sola lettura); altrimenti una chiamata `execute_code` che elenca i componenti della library con il loro `pagebuilder.contract`. Nient'altro.
5. Presenta le voci con lo stato letto in una riga (componenti con e senza contratto, domande aperte sul componente dato). Non insistere con un menu: se l'utente ha già dato voce e componente, parti da lì.

## Le voci

| Codice | Voce | Cosa produce | Reference |
|---|---|---|---|
| **ET** | Estrai tema | `theme.css`, `themes/*.css`, `fonts.css`, `tokens.generated.ts` dai set e temi di Penpot (via `extract_theme`) | `references/theme-extract.md` |
| **VC** | Verifica componente | `verify_component`: blocchi, avvisi, domande; il `contract` mancante; le risposte scritte in Penpot una per conferma | `references/verify.md` |
| **GC** | Genera componente | `build_order` → `generate_component`: `styles.ts`, scaffold, story; giudizio in Storybook | `references/generate.md` |
| **AC** | Riallinea stili | `styles.ts` rigenerato dopo un cambio di aspetto; il TSX resta identico; i cambi di struttura solo come diff proposto | `references/align.md` |
| **GA** | Gate | `check-types` + `test`: tema nel CSS, contrasto, font, axe sulle story `@generated`, file `@generated` intatti | `references/gate.md` |

Strade: *dal contratto* (CN → DC, in `pds-design`) → **GC**; *dal design* (DC libero → CD, in `pds-design`) → **GC**; tema **ET**; aspetto **AC**; struttura **MS** (in `pds-design`) → **AC**; chiusura **GA**.

Le domande del nucleo e le chiavi che le chiudono stanno in `references/answers.md`, con lo snippet `execute_code` di scrittura e rilettura: è l'unico posto in cui questa skill scrive su Penpot.

## Riferimenti

- `references/answers.md` — domanda → chiave → shape → valore, snippet di anteprima, scrittura e rilettura; le operazioni di Penpot che possono cancellare i plugin data.
- `references/theme-extract.md` — ET.
- `references/verify.md` — VC: contratto mancante, domande, avvisi.
- `references/generate.md` — GC: ordine, file scritti, giudizio in Storybook.
- `references/align.md` — AC: aspetto contro struttura.
- `references/gate.md` — GA: i comandi, cosa li rende rossi, come si riporta un rosso.
