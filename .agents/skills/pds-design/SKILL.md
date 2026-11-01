---
name: "pds-design"
description: "Porta in Penpot tema e componenti del page builder e propone i contratti dell'editor da approvare. Use only when explicitly invoked as 'pds-design' (or /pds-design), or when the user says 'porta il tema in Penpot', 'variante di tema', 'nuovo contratto', 'disegna il componente', 'contratto dal design', 'modifica la struttura', 'stato del componente', or picks a voice code (TB, TV, CN, DC, CD, MS, ST). Generic Penpot requests are the kit's penpot-* skills."
---

# pds-design

Porta in Penpot il tema e i componenti del page builder e mette per iscritto i contratti dell'editor che lo sviluppatore approva. Lavori con il designer di riferimento — non tecnico — dentro Penpot, con il kit ufficiale penpot-ai-kit; chi consuma il risultato è `pds-code`, che rilegge Penpot dal vivo e genera gli stili. La barra è la fedeltà: nessun valore inventato, nessuna classe persa in silenzio, nessuna scrittura senza un sì esplicito.

## Resolution rules

- Bare paths and `{skill-root}` (e.g. `references/theme-base.md`) resolve from this skill's installed directory.
- `{project-root}` → the project working directory.
- `{skill-name}` → the skill directory's basename.

## Su cosa non si transige

- **Niente plugin data.** Non scrivi mai le shared plugin data `pagebuilder` (`contract`, `part`, `when`, `slot`, risposte): le scrive `pds-code`, con conferma. Le leggi e le mostri, questo sì.
- **Una conferma per ogni scrittura mostrata**, su Penpot come sui contratti: prima l'anteprima (l'elenco dei file da scrivere, il diff, l'`export_shape` della cella o la matrice), poi il sì. Un sì vale per ciò che hai mostrato — l'elenco dei file, le celle della matrice, i set del tema — non per un file o una cella aggiunti dopo: se qualcosa cambia dopo il sì, serve un nuovo sì.
- **Le celle si costruiscono da zero**, una per chiamata `execute_code`, e la verifica (`shape.tokens`, `tokenOverview()`, elenco celle) in una chiamata separata: `applyToken` è asincrono e lento (~0,8 s a legame). Il `createVariants.js` del kit annida una copia nel clone: non usarlo.
- **Contratti**: vivono solo in `packages/contracts`; un asse o un field cambiato alza `SCHEMA_VERSION` e aggiunge una voce al fingerprint. Una voce di una versione **mai rilasciata** si riscrive, una rilasciata non si riscrive mai. La regola per `nome@versione` è la regola A. Vedi `references/contract-rules.md`.
- **Nessun token inventato.** Si usano i set che ci sono; un token nuovo si propone al designer e si approva (governance di `penpot-foundations`). Aggiustare un valore in Penpot è un sì, non una correzione silenziosa.
- **Trigger.** Questa skill parte solo su invocazione esplicita o su una delle frasi qui sopra: «imposta i design token», «crea un Button con le varianti» e simili restano del kit (`penpot-router`, `penpot-foundations`, `penpot-component-factory`). Se l'invocazione è nata da una richiesta generica a Penpot, dillo e passa la mano.

## On activation

1. Leggi `{project-root}/_bmad/config.yaml`, sezione `pds`. Deve avere `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource`. Se manca o è diversa, fermati **prima di ogni scrittura** e chiedi di eseguire `pds-setup`: la pipeline non implementa altri valori. La sola lettura dello stato (ST) resta possibile.
2. Controlla i due server MCP di `{project-root}/.mcp.json`: `pds` (stdio; gli strumenti del nucleo — `tokens_from_css`, `describe_component`, `verify_component`, `build_order`, `generate_component`, `extract_theme`) e `penpot` (`http` su `http://localhost:9001/mcp/stream`, su cui esegui `execute_code`). Se il client non registra `pds` (per esempio `opencode.json` ha solo `penpot`) la skill non può leggere contratti né verificare: **fermati e dillo**, senza indicare un reconnect che non esiste. Se `pds` è registrato ma non risponde, la via è `/mcp` → `pds` → reconnect (dopo una modifica del nucleo il processo va riavviato), e intanto fermati.
3. Chiedi conferma che il plugin MCP sia connesso al file Penpot aperto (File → Plugins → MCP Server → Connect) e che la scheda resti visibile: a scheda sospesa il plugin si ferma.
4. **Una sola lettura** per mostrare lo stato: una chiamata `execute_code` al server `penpot` con `penpotUtils.tokenOverview()` e l'elenco dei componenti della library (e, se serve, la lettura di `packages/contracts/src/registry.ts`). Nient'altro.
5. Presenta le voci con lo stato letto in una riga (set e temi presenti, componenti disegnati, contratti registrati). Non insistere con un menu: se l'utente ha già dato voce e componente, parti da lì.

## Le voci

| Codice | Voce | Cosa produce | Reference |
|---|---|---|---|
| **TB** | Tema base dal seme | set e temi Penpot da un `theme.css` (via `tokens_from_css` e `penpot-foundations`) | `references/theme-base.md` |
| **TV** | Variante di tema | un set di colori + un tema per `[data-<gruppo>="<nome>"]` | `references/theme-variant.md` |
| **CN** | Contratto nuovo | ricetta → domande → proposta del contratto → approvazione → file | `references/contract-new.md` |
| **DC** | Disegna componente | container e celle in Penpot, dal contratto o libero | `references/draw-component.md` |
| **CD** | Contratto dal design | bozza del contratto da `describe_component` → approvazione | `references/contract-from-design.md` |
| **MS** | Modifica struttura | diff fra Penpot e contratti → approvazione | `references/structure-diff.md` |
| **ST** | Stato | `verify_component`: blocchi, avvisi, domande, chiavi mancanti o doppie | `references/status-check.md` |

Strade: *dal contratto* CN → DC (e poi `pds-code` GC); *dal design* DC libero → CD (poi GC). Un cambio di aspetto si fa in Penpot e lo porta in codice `pds-code` AC; un cambio di struttura passa da MS.

## Il kit

Sei un wrapper delle skill del kit dove ha senso, con le divergenze del progetto dichiarate in `references/kit-wrappers.md`: `penpot-foundations` per token e temi, `penpot-component-factory` per componenti e varianti, `penpot-rename-layers` solo su richiesta. Se la skill del kit non è installata, segui la procedura della reference con `execute_code`: non copiare codice del kit nel repo e non inventare script.

## Riferimenti

- `references/kit-wrappers.md` — come delegare al kit, cosa cambia, i limiti da ricordare.
- `references/contract-rules.md` — forma del contratto, registrazione, bump di `SCHEMA_VERSION` e fingerprint (regola A).
- `references/theme-base.md`, `references/theme-variant.md` — TB e TV.
- `references/contract-new.md`, `references/draw-component.md`, `references/contract-from-design.md`, `references/structure-diff.md`, `references/status-check.md` — CN, DC, CD, MS, ST.
