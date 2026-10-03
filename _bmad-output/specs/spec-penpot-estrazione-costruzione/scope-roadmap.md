# Scope e Roadmap — token → atomi → organismi

Contratto di confine per CAP-9. SPEC madre: [SPEC.md](./SPEC.md).

## Catalogo

- **Token:** origine Penpot, single source of truth dei valori.
- **Atomi:** button, switch, checkbox, select, input base.
- **Molecole:** combinazioni di atomi (es. field + label + hint, button-group).
- **Organismi:** card, tabelle, header, footer, sidebar, dashboard, hero, carousel.

## Stop

- Template e pagine **esclusi**: composti con Puck.
- Contratto tra i due sistemi via **Tailwind theme**: token Penpot mappati in variabili CSS esposte come theme (`@theme` / `tailwind.config`), consumate da Puck; nessuna struttura generata da questo sistema oltre gli organismi.

## Roadmap a livelli

Confermata L0-L3. Ogni livello sblocca il successivo solo a completamento del precedente:

1. **L0 Token:** lettura live + diff vs codice + allineamento in un colpo dopo conferma esplicita.
2. **L1 Atomi:** estrazione da-zero/headless con gate componente-token verde, profili dal repo.
3. **L2 Molecole:** composizione di atomi validati, nessun nuovo token implicito.
4. **L3 Organismi:** card e simili, incluso caso guida card end-to-end.

Criterio di sblocco confermato: livello completo quando ogni entità del livello passa check iniziale + gate + doppio contratto fedeltà con giudizio umano.
