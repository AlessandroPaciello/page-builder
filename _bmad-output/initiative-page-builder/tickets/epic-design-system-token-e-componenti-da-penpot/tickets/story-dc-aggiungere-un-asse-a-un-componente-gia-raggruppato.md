---
id: 39
type: story
title: "DC: aggiungere un asse a un componente già raggruppato"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: ["119"]
hitl: false
risk: medium
refined: true
tracker_id: "122"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/122"
tracker_status: backlog
---

# DC: aggiungere un asse a un componente già raggruppato

## Description

La voce DC di `pds-design` sa disegnare celle nuove e raggrupparle, ma non toccare un container di varianti che esiste già: `group_variants` risponde «già raggruppato» e non scrive, e nessuna reference dice come aggiungere una proprietà. La voce impara la procedura — leggi gli assi, aggiungi la proprietà, dai il valore alle celle esistenti, adatta o crea le celle nuove, verifica, mostra e chiedi il sì — e la prova sulla Multiselect su un file duplicato, dove il pannello ha già l'asse `search` e la composizione no. Il file vero lo tocca la 2.37 con la stessa procedura.

## Requirements

1. **Asse aggiunto** (R2)
   **Given** un container di varianti che esiste, con le sue celle
   **When** il designer chiede una proprietà nuova sulla composizione
   **Then** la proprietà compare sugli assi del container e ogni cella esistente porta il valore concordato (il default)

2. **Celle nuove o adattate** (R2)
   **Given** il punto 1
   **When** la proprietà nuova ha un valore che il disegno deve mostrare
   **Then** le celle di quel valore esistono, e dove serve un'istanza annidata è passata alla variante corrispondente
   **And** le celle che non interessano la proprietà restano identiche, valori e token compresi

3. **Verifica e idempotenza** (R2)
   **Given** il punto 2
   **When** si esegue di nuovo la procedura
   **Then** non cambia nulla
   **And** `describe_component` legge i valori nuovi su ogni cella e `verify_component` dà il solo blocco «manca il contratto», senza blocchi di asse estraneo

4. **Rifiuto** (R2)
   **Given** una proprietà con nome già presente o non conforme a `IDENTIFIER`, oppure un valore che il designer non ha concordato
   **When** si esegue la procedura
   **Then** è rifiutata nominando la cella o la proprietà, senza scrivere
   **And** un valore concordato e non ancora disegnato si disegna, non è un rifiuto

5. **Prova sulla Multiselect** (R2)
   **Given** il file Penpot duplicato, con il pannello che ha già `search` (`false`, `true`) e la ricerca disegnata
   **When** si applica la procedura alla composizione Multiselect con `search` (`false`, `true`, default `false`)
   **Then** le due celle aperte `md` e `sm` con `state=default` usano il pannello `search=true`, tutte le altre celle restano a `false` e nessuna cambia aspetto
   **And** i token legati e i nomi delle celle restano quelli di prima

## Boundaries

- Must not change: le celle del pannello e la ricerca già disegnata; le celle della composizione che la proprietà non tocca. Nella reference DC la riga «non aggiusti il disegno del designer» resta, con questa procedura come sola eccezione e la conferma come condizione.
- Must not change: la regola per cui si disegna solo ciò che il designer approva, e la conferma prima di ogni scrittura.
- Fuori: il contratto e il fingerprint (li tocca MS), i plugin data `pagebuilder` (li scrive `pds-code`).

## Notes

- Risk: medium — è una scrittura su un container che esiste, quindi un errore può rompere celle già buone; la prova si fa su un file duplicato.
- Decision: 2026-11-01 — la procedura vive nella voce DC, non in una skill nuova, perché condivide lettura degli assi, verifica e conferme. La prova è sul file Penpot duplicato; l'applicazione al file vero la fa la 2.37 con la stessa procedura, dopo il sì.
- La procedura è nuova in questo repo: `penpot-component-factory` del kit non è installato, quindi nessuna reference locale la copre.
- Percorsi utili (sorgente; `.agents/skills` e `.claude/skills` sono copie): `skills/pds/pds-design/references/draw-component.md`, `skills/pds/pds-design/references/contract-rules.md`, `packages/scripts/src/core/group-variants.ts`.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
- story — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/tickets/story-operazione-pds-di-raggruppamento-in-varianti.md (2.36, il raggruppamento da cui la procedura parte)
- skill — skills/pds/pds-design/references/draw-component.md (DC, dove entra la procedura)
- skill — skills/pds/pds-design/references/contract-rules.md (la forma degli assi e i nomi ammessi)
