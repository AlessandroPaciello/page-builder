# Glossario

Companion di [SPEC.md](./SPEC.md). Termini di dominio, stack-agnostici.

- **Page (Pagina)** — entità di contenuto pubblicabile, identificata da uno **slug** univoco, con metadati SEO e uno stato di lifecycle (DRAFT/PUBLISHED/ARCHIVED). Ha una relazione 1:N con le sue versioni.
- **Slug** — identificatore pubblico univoco della pagina, usato per il render by-slug.
- **PageVersion (Versione)** — snapshot del contenuto di una pagina, con numero progressivo, stato (DRAFT/PUBLISHED) e un **payload**. Al più una versione PUBLISHED per pagina.
- **Lifecycle** — stati della pagina: DRAFT (bozza), PUBLISHED (pubblicata), ARCHIVED (archiviata). L'archiviazione preserva le versioni.
- **Payload** — rappresentazione strutturata del layout di una pagina, nella forma Puck `{content, root, zones}` con `schemaVersion`. Accettato 1:1 senza riscrittura.
- **Block-id stabile** — ogni blocco nel payload porta un id persistente indipendente dalla posizione, che abilita diff/audit/merge a livello di blocco tra versioni.
- **Token** — valore di design (colore/tipografia/spacing/radius/ombra) generato da Penpot, fonte di verità stilistica.
- **Primitive** — componente UI headless/accessibile riusabile, agnostico rispetto al dominio page-builder.
- **Puck block (blocco)** — primitiva incapsulata come blocco dell'editor, con campi editabili e controlli guidati dai token.
- **Composizione (ui)** — componente composto con semantica dell'editor (es. TopBar, PageList), costruito su primitive+token.
- **Campo structure vs content** — classificazione dei campi di un blocco: `content` = testo/contenuto editabile (sanitizzato); `structure` = layout/configurazione. Pilota permessi editor e sanitizzazione.
- **Ruoli** — Admin, Editor, Cliente (vedi [rbac-matrix.md](./rbac-matrix.md)).
- **Audit trail** — storico immutabile di chi ha cambiato cosa e quando su pagine/versioni; consultabile solo dall'Admin; copre metadati immutabili (non duplica i blob di contenuto).
- **Render by-slug** — resa pubblica di una pagina via slug: versione pubblicata di default, ultima bozza su richiesta.
