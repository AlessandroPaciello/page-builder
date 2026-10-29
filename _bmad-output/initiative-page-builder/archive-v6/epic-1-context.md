# Epic 1 Context: Fondamenta vive — leggere, diffare, proporre

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->
<!-- Fonte: _bmad-output/planning-artifacts/epics-penpot-estrazione-costruzione.md (slice separata da epics.md page-builder). Attenzione: numerazione 1-4 riusata, non confondere con Epic 1 page-builder (scaffolding, done). -->

## Goal

Dopo questa epic il sistema legge Penpot live via MCP, mostra diff token e propone fix chiedendo conferma umana, senza generare ancora nulla. È la base verificabile per ogni passo successivo.

## Stories

- Story 1.1: Prima lettura live con disciplina
- Story 1.2: Diff token e proposta in un colpo
- Story 1.3: Canarino del primo gate H1
- Story 1.4: Tracciante verticale su un token

## Requirements & Constraints

- Lettura live via MCP on-demand, senza cache né fixture; ogni stadio rilegge e mostra fotografia congelata che è l'unica base decisionale, rilettura successiva solo per invalidarla.
- Check iniziale obbligatorio prima di ogni estrazione: verifica headless+token, scansione MCP+repo, diff token, proposta applicabile in un colpo solo dopo conferma esplicita; mai errore secco senza proposta.
- Zero metadati manuali per singolo componente; contratto solo da segnali vivi MCP + convenzioni atomic + token Penpot.
- Regole come fix applicabili, mai blocchi muti; interpretazione confermata prima di generare.
- Conferma umana in conversazione come unico gate (H1 allineamento+Penpot, H2 generazione); un sì = un piano-diff numerato; sì esecutivi mai persistenti.
- Mani solo su file hand-owned; mai su `@generated` e `tailwind-theme.css`; extras solo additivo; un token un solo proprietario.
- Profili JSON in `packages/scripts/profiles/<nome>.json` con name/version/headless/tokens; validatore = rilettura skill + ratifica umana; per specie, mai per istanza.
- Livelli L0-L3 sequenziali; il successivo bloccato fino a completamento del precedente.

## Technical Decisions

- Nessun runtime dedicato: flusso come step della skill via MCP + repo; vietato creare package/moduli runtime; `packages/scripts` resta per comandi esistenti ma non guida questo flusso.
- Base congelata: fotografia dello stadio citata dallo stadio dopo; mai basi miste.
- Precedenza shadcn < extras < generato; cambiare un valore esistente = cambiare in Penpot + rigenerare, oppure rimozione esplicita.
- Token verso Puck solo via theme variables `@theme` (Tailwind v4 CSS-first); nessuna struttura oltre organismi.
- Stack pinnato al 2026-10-03: Tailwind ^4.3.2 installato, `@base-ui/react` ^1.8.0 da installare al primo profilo headless (L1), `@puckeditor/core` 0.23.x differito, MCP Penpot via `docker/penpot` + `PENPOT_MCP_TOKEN`.
- Gate a 4 controlli prima del sì: contratto esistente, ruoli ammessi, token nel vocabolario, nomi in convenzione; esito go/no-go per voce.
- Riferimento card opzionale in `assets/card-reference/`; assenza non bloccante con segnalazione.

## Cross-Story Dependencies

- Sequenza interna 1.1 → 1.2 → 1.3 → 1.4; 1.1 produce fotografia congelata citata da 1.2; 1.2 produce piano-diff numerato per H1 in 1.3; 1.4 chiude un token e sblocca Epic 2.
- Verso Epic 2: L0 per quel token soddisfatto come precondizione; nessun profilo headless ancora (L1).
- Da parent spine 2026-07-25: contratti in `packages/contracts`, headless solo in `ui/src/domains`, payload Puck di contracts.
