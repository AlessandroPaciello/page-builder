---
id: 41
type: story
title: "Carousel: sezione con slot e comportamento"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R1, R3]
after: ["98", "127"]
hitl: true
risk: medium
tracker_id: "128"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/128"
tracker_status: backlog
---

# Carousel: sezione con slot e comportamento

## Description

Il Carousel, sezione con lo slot `slides` che contiene le ShopCard della 2.40, si disegna in Penpot dalla strada dal contratto (CN→DC) con lo slot come layer contenitore, si genera con GC e riceve il comportamento: non esiste un primitivo Base UI, quindi ricetta shadcn `base` e pattern APG letti dal vivo, con la dipendenza scelta dallo sviluppatore o l'alternativa senza dipendenze, un diff e un test per comportamento. Il giudizio visivo è in Storybook.

## Requirements

Verify: Il Carousel ha `styles.ts` e story `@generated`, il TSX dello sviluppatore con i test di tastiera e controlli, axe verde e il giudizio in Storybook; lo slot è riconosciuto come layer contenitore e le istanze non producono domande `part`; `build_order` genera Badge → ShopCard → Carousel; i quattro livelli della CI sono verdi senza leggere Penpot.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
