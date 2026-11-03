---
id: 42
type: bug
title: "DC raggruppa celle che non sono componenti e `group_variants` non le trova"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P2
tracker_id: "131"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/131"
tracker_status: backlog
---

# DC raggruppa celle che non sono componenti e `group_variants` non le trova

## Description

Chi segue la voce DC di `pds-design` costruisce le celle da zero come board con il nome `Component / Axis=Value`, poi chiama `group_variants`. Lo strumento risponde che il componente non esiste, perché cerca le celle solo fra i componenti della library e le board non lo sono. La reference di DC deve far rendere componente ogni cella appena costruita, così il raggruppamento riesce al primo tentativo.

## Reproduction

Sessione del 2026-11-03, ShopCard ridisegnata dalla strada dal design (story 2.40), file Penpot `tailwind`.

1. Con DC, costruire due board da zero, una per chiamata `execute_code`: `ShopCard / size=default` e `ShopCard / size=sm`, con token legati e verifica separata, come dice il passo 3 del Disegno.
2. Chiamare `group_variants { "component": "ShopCard" }`.
3. Risultato: `group_variants: nessun componente «ShopCard» in Penpot — nessun container (o componente principale) ha il plugin data pagebuilder/contract, e nessuno si chiama così o ha celle «ShopCard / Axis=Value»`. Le due board però esistono, con quel nome.
4. Rendere componente ciascuna board con `penpot.library.local.createComponent([board])`; il nome dell'istanza principale resta `ShopCard / size=…`.
5. Richiamare `group_variants { "component": "ShopCard" }`: risponde `raggruppato`, con il container `ShopCard` e le due celle `size`.

Atteso: seguendo la reference di DC, le celle sono già componenti quando si arriva al raggruppamento, e il passo 2 riesce.

## Cause Hypothesis

La regola manca nella reference di DC di `pds-design` (`references/draw-component.md`, sezione Disegno, passi 3 e 6). Il passo 4 della sezione «Aggiungere un asse a un container esistente» usa già `createComponent`, mentre il Disegno no. La lettura delle celle (`readVariantCells` nell'adattatore Penpot di `group_variants`) parte da `penpot.library.local.components`, quindi una board che non è componente non viene vista.

## Acceptance Criteria

1. **Le celle di DC sono componenti prima del raggruppamento**
   **Given** un componente nuovo da disegnare con DC, con due o più celle
   **When** si segue la reference di DC dalla prima cella al raggruppamento
   **Then** ogni cella viene resa componente subito dopo averla costruita; una chiamata separata verifica che l'istanza principale sia componente principale e conservi il nome `Component / Axis=Value`; `group_variants` raggruppa al primo tentativo
2. **La regola è scritta dove la si legge**
   **Given** la skill `pds-design`
   **When** si leggono la reference di DC e i limiti in `references/kit-wrappers.md`
   **Then** il passo delle celle nomina il passaggio a componente e la sua verifica, e il passo del raggruppamento dice che `group_variants` legge solo componenti della library
3. **Oppure: non serve alcuna modifica, con la prova**
   **Given** la riproduzione
   **When** la si rifà sulla skill attuale
   **Then** il raggruppamento riesce già al primo tentativo, o la segnalazione era sbagliata, con l'evidenza nelle Notes — questo sostituisce 1 e 2

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
- skill — .agents/skills/pds-design/references/draw-component.md, Disegno (passi 3 e 6)
- skill — .agents/skills/pds-design/references/kit-wrappers.md, Limiti da ricordare
- story — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/tickets/story-badge-e-shopcard-con-le-due-strade.md (dove è emerso)

## Notes

- Open question: il messaggio di `group_variants`, quando trova board `Component / Axis=Value` che non sono componenti, potrebbe nominarle e dire di renderle componenti; è fuori dallo scope di questo bug, salvo decisione diversa durante il lavoro.
- Lo stesso giorno è emerso un secondo caso: un container vecchio rinominato ma con ancora il plugin data `contract = shop-card@1` risponde al nome del contratto, e `group_variants { "component": "shop-card" }` ha restituito `già raggruppato` sul container vecchio. Si è aggirato passando il nome del layer (`ShopCard`). Va solo ricordato nella reference, se serve: il plugin data lo gestisce `pds-code`.
