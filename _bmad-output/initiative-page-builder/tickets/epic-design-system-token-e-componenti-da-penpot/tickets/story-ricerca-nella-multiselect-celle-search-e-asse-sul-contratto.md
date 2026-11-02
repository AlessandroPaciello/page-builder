---
id: 37
type: story
title: "Ricerca nella Multiselect: celle `search` e asse sul contratto"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: ["122"]
hitl: false
risk: low
tracker_id: "121"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/121"
tracker_status: done
refined: true
---

# Ricerca nella Multiselect: celle `search` e asse sul contratto

## Description

La Multiselect composta non mostra mai la ricerca: tutte le celle usano il pannello con `search=false`, quindi dal blocco `multiselect` la ricerca non si può accendere. In Penpot il pannello ha già l'asse `search` con le quattro celle e la ricerca disegnata; manca l'asse sulla composizione. La 2.39 dà alla skill la procedura per aggiungerlo (le 12 celle esistenti a `false`, le due aperte `md` e `sm` con il pannello a `search=true`); poi il contratto `multiselect` riceve l'asse `search` (`false`, `true`, default `false`) e il blocco lo espone come campo. Penpot resta la fonte di verità: l'asse non entra nel contratto prima che il disegno lo mostri.

## Requirements

1. **Celle disegnate** (R2)
   **Given** il componente Multiselect in Penpot, con il pannello che ha già `search` e la ricerca disegnata
   **When** la 2.39 ha aggiunto l'asse `search` alla composizione
   **Then** ogni cella esistente ha `search=false`
   **And** le due celle aperte `md` e `sm` usano il pannello con `search=true`

2. **Lettura delle celle** (R2)
   **Given** le celle del punto 1
   **When** si lancia `describe_component` su Multiselect
   **Then** legge le due celle con `search=true` e tutte le altre con `search=false`

3. **Verifica** (R2)
   **Given** il punto 2
   **When** si lancia `verify_component { name: "Multiselect" }`
   **Then** l'unico blocco è la mancanza di `pagebuilder/contract`, e ogni cella porta `search`

4. **Asse sul contratto** (R2)
   **Given** il punto 3 soddisfatto
   **When** si legge il contratto `multiselect`
   **Then** espone l'asse `search` con valori `false` e `true` e default `false`
   **And** il blocco `multiselect` lo mostra come campo

5. **Fingerprint** (R2)
   **Given** la versione 6 dello schema non è su `main`
   **When** si aggiunge l'asse
   **Then** la voce 6 del fingerprint include l'asse `search`, la versione dello schema resta 6 e la sua nota di versione lo dice
   **And** il test del fingerprint passa

Il passo 1 è della skill con la procedura della 2.39; il lavoro sul contratto parte solo dopo che le celle esistono. Senza celle l'asse non si aggiunge.

## Boundaries

- Must not change: i contratti `multiselect-trigger` e `multiselect-panel` restano senza l'asse `search`; la nota in `multiselect-panel` che rimanda alla 2.35 si aggiorna.
- Must not change: l'aspetto delle celle esistenti.

## Notes

- Risk: low — aggiunge un asse facoltativo con default `false` a un solo contratto, senza toccare i payload esistenti.
- Decision: 2026-11-01 — la voce 6 si riscrive perché non è su `main`; se fosse già rilasciata al momento della build, il ticket si riapre per aggiungere la 7.
- Stato del disegno (2026-11-01): il pannello ha già le quattro celle con `search` e la ricerca disegnata (board `Search`, `Icon / search`, `Search placeholder`); la composizione ha gli assi `size`, `open`, `display`, `state` e 12 celle, senza `search`.
- Percorsi utili: `packages/contracts/src/components/multiselect.ts`, `packages/contracts/src/schema-version.ts`, `packages/contracts/tests/contracts.fingerprint.json`.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
- story — story-operazione-pds-di-raggruppamento-in-varianti.md (2.36, raggruppamento in varianti usato per le celle)
- epic Notes — il Decision del 2026-11-01 sulla ricerca della Multiselect, nel file dell'epic
- story — story-dc-aggiungere-un-asse-a-un-componente-gia-raggruppato.md (2.39, la procedura che aggiunge l'asse)
