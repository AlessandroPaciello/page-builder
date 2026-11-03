---
id: 40
type: story
title: "Badge e ShopCard con le due strade"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R1, R2, R3]
after: []
hitl: true
risk: medium
tracker_id: "127"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/127"
tracker_status: in-progress
---

# Badge e ShopCard con le due strade

## Description

Badge si porta in codice dalla strada dal contratto (DC→GC: `badge@1` esiste già) e ShopCard da quella dal design (DC libero→CD→GC), con la card che contiene un'istanza di Badge. `product-card@1` si rimuove: il contratto nuovo è `shop-card@1`, scritto da CD sulla forma disegnata, e la sezione Carousel aggiorna lo slot `slides` e i tre figli di default; `SCHEMA_VERSION` va a 7 con la voce nuova nel fingerprint, la 4 resta. Entrambi hanno `styles.ts` e story `@generated`, il TSX dello sviluppatore con i test, axe verde e il giudizio visivo in Storybook.

## Requirements

Verify: Badge e ShopCard hanno `styles.ts` e story `@generated`, il TSX dello sviluppatore con i suoi test, axe verde e il giudizio in Storybook; ShopCard contiene un'istanza di Badge e `build_order` li ordina Badge → ShopCard; `product-card@1` non esiste più, nel registro c'è `shop-card@1` e il fingerprint ha la voce 7 con `SCHEMA_VERSION` 7; lo slot `slides` del Carousel ammette `shop-card` e i suoi tre figli di default usano i field di `shop-card`; i quattro livelli della CI sono verdi senza leggere Penpot.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
