# Collaudo degli aggiornamenti di Penpot (Story 2.25)

`readComponent` e `readPenpotTokenCatalog` leggono Penpot dal vivo. Il collaudo dice se una versione di Penpot li rompe. Prima di aggiornare il Penpot vero, si importa un campione in un'istanza nuova e si lancia un test a mano.

- `campione.penpot` è il file Penpot del campione, con i suoi token: usa ogni voce del registro e ogni chiave di plugin data. Non è una lettura: nel repo non si salvano letture, JSON della `Lettura` né snapshot (regola 5).
- `collaudo.live.test.ts` è il test. Si salta senza `PDS_PENPOT_COLLAUDO=1`, quindi in CI non gira mai.
- Questo README: la procedura, il campione e la tabella proprietà → layer → valore. Il test legge la tabella per dire quale layer guardare quando manca qualcosa.

Riferimento: Penpot 2.18.3 (il Penpot vero oggi). Il collaudo di riferimento si fa su un'istanza nuova 2.18.3.

## Procedura di aggiornamento

I comandi partono dalla root del repo. Il compose è lo stesso del Penpot vero (`docker/penpot/docker-compose.yml`). L'istanza di collaudo è un secondo progetto compose, `penpot-collaudo`, con volumi suoi (`penpot-collaudo_penpot_*`). Il progetto `penpot` e i suoi volumi (`penpot_penpot_assets`, `penpot_penpot_postgres_v15`) non si toccano.

1. **Backup del Penpot vero**, prima di ogni migrazione, fuori dal repo:
   ```bash
   B=~/penpot-backup/$(date +%F) && mkdir -p "$B"
   docker compose -f docker/penpot/docker-compose.yml exec -T penpot-postgres pg_dump -U penpot -d penpot -Fc > "$B/penpot.dump"
   docker run --rm -v penpot_penpot_assets:/assets:ro -v "$B":/backup alpine tar czf /backup/penpot-assets.tgz -C /assets .
   ```
   **Ripristino**, solo se l'aggiornamento del Penpot vero fallisce: riporta `PENPOT_VERSION` alla versione di prima, poi
   ```bash
   docker compose -f docker/penpot/docker-compose.yml stop penpot-frontend penpot-backend penpot-exporter penpot-mcp
   docker compose -f docker/penpot/docker-compose.yml exec -T penpot-postgres pg_restore -U penpot -d penpot --clean --if-exists < "$B/penpot.dump"
   docker run --rm -v penpot_penpot_assets:/assets -v "$B":/backup alpine sh -c 'rm -rf /assets/* && tar xzf /backup/penpot-assets.tgz -C /assets'
   docker compose -f docker/penpot/docker-compose.yml up -d
   ```
2. **Ferma il Penpot vero** (le porte 9001, 4401, 4402 e 1080 sono le stesse): `docker compose -f docker/penpot/docker-compose.yml stop`. Solo `stop`: mai `down -v` senza `-p penpot-collaudo`.
3. **Istanza nuova** (per una versione candidata, `PENPOT_VERSION=<versione>` davanti al comando; senza, 2.18.3):
   ```bash
   docker compose -p penpot-collaudo -f docker/penpot/docker-compose.yml up -d
   ```
4. **Utente**: registrati su [http://localhost:9001](http://localhost:9001). Le mail arrivano a [http://localhost:1080](http://localhost:1080).
5. **Token MCP**: *Settings → Integrations → MCP server*, attivalo e copia il token. È diverso da quello del Penpot vero. Un `export` nella shell non basta: direnv (`.envrc` = `dotenv`, anche l'estensione VS Code `mkhl.direnv`) lo sovrascrive con il `.env`. Per il test il token si passa sulla riga di comando (passo 8). Per costruire il campione con Claude Code, metti per un po' il token di collaudo nel `.env`, tenendo da parte quello vero, e riapri VS Code (vedi il [README alla root](../../../README.md#penpot-locale-e-server-mcp)); il token vero torna nel `.env` al passo 9.
6. **Import**: in un progetto, *Import* → `packages/scripts/collaudo/campione.penpot`. Apri il file importato.
7. **Plugin**: nel file, *File → Plugins → MCP Server → Connect*. Tieni la scheda visibile (vedi [Scheda Penpot sospesa](../src/penpot/README.md#scheda-penpot-sospesa)).
8. **Collaudo**:
   ```bash
   PENPOT_MCP_TOKEN=<token-collaudo> PDS_PENPOT_COLLAUDO=1 pnpm --filter @penpot-ds/scripts exec vitest run collaudo/
   ```
9. **Chiusura**: `docker compose -p penpot-collaudo -f docker/penpot/docker-compose.yml down -v` (cancella solo i volumi `penpot-collaudo_*`), poi `docker compose -f docker/penpot/docker-compose.yml start`. Se al passo 5 hai messo il token di collaudo nel `.env`, rimetti quello vero e riapri VS Code. Controlla con `docker volume ls` che i volumi `penpot_penpot_*` ci siano ancora.

**Il Penpot vero si aggiorna solo se il collaudo passa** sulla versione candidata. Poi si alza `PENPOT_VERSION` (default nel compose) e la versione di riferimento in questo README, in `src/penpot/README.md` e in `penpot-pipeline.md`.

## Migrazione o guasto

Se il collaudo fallisce, il messaggio nomina la proprietà o la chiave e il layer atteso (dalla tabella sotto). Guarda via MCP Penpot (`execute_code`, sola lettura) il valore grezzo su quel layer, per esempio `shape.flex.alignItems` o `shape.getSharedPluginData("pagebuilder", "slot")`.

- Il valore è **sparito o cambiato dopo l'import**: è una migrazione dell'import `.penpot` della versione nuova. Il campione va ricostruito o il dato rimesso, e la migrazione va annotata.
- Il valore **c'è ma manca nella `Lettura`**: è un guasto dell'adattatore (`src/penpot/read-component.ts`). Diventa una voce di `deferred-work.md`, salvo una correzione di una riga concordata.

## Il campione

Un file Penpot con due pagine e un set di token suo, `collaudo` (attivo).

**Pagina "campione":**

- `Etichetta`: componente principale semplice (board con un testo). Serve solo come istanza annidata.
- `Collaudo`: container di varianti, plugin data `pagebuilder.contract = collaudo@1`, asse `tono` con due celle (`primario`, `secondario`). Ogni cella è una board flex in colonna con questi figli:
  - `Riga`: board flex in riga, con dentro `Testo` (testo) e `Quadrato` (rettangolo 16×16, misura fissa);
  - `Slot`: board che contiene solo un'istanza di `Etichetta`;
  - `FlexNonToccato`: board a cui si aggiunge il layout flex senza cambiare nient'altro;
  - `Assoluto`: rettangolo con *Ignora layout* (assoluto), ancorato a destra e in basso.
- `FillDentroHug`: componente principale senza contratto. Board flex in riga che abbraccia il contenuto in orizzontale (hug), con un figlio `Pieno` (rettangolo) in *fill* orizzontale.

**Pagina "doppione":** `CollaudoDoppione`, un secondo container di varianti con lo stesso plugin data `contract = collaudo@1` e almeno una cella.

Il test legge il container principale per nome (`readComponent("Collaudo")`): la ricerca per contratto confronta il nome esatto, e "Collaudo" non è un contratto, quindi si passa al nome del layer e si trova solo il container principale. `readComponent("collaudo")` trova invece i due container per contratto e deve dare l'errore che li elenca.

**Token del set `collaudo`:**

| Token | Tipo | Valore |
|---|---|---|
| `sfondo`, `primario`, `bordo` | color | `#f8fafc`, `#2563eb`, `#94a3b8` |
| `spacing.2`, `spacing.4`, `spacing.6` | spacing | `8`, `16`, `24` |
| `radius.md` | borderRadius | `6` |
| `bordo.sottile` | borderWidth | `2` |
| `text.lg` | fontSizes | `18` |
| `peso.bold` | fontWeights | `700` |
| `font.sans` | fontFamilies | `Source Sans Pro` |
| `tracking.wide` | letterSpacing | `0.5px` |
| `opacity.meta` | opacity | `0.5` |
| `shadow.sm` | shadow | `0 1 2 0 #0000001a` |

`spacing.4` = 16px è il passo della scala (`--spacing-4`) che dà `w-4` a `Quadrato`.

### Proprietà e chiavi → layer → valore

Il layer è quello di ogni cella di `Collaudo`, se non è detto altro. Le parole chiave hanno un valore diverso dal default (il test lo controlla); `layoutAlign` ha anche il default `stretch` su `FlexNonToccato`.

| Proprietà o chiave | Layer | Valore |
|---|---|---|
| `fill` | radice della cella e `Testo` | token `sfondo` (radice), `primario` (`Testo`) |
| `strokeColor` | radice della cella | token `bordo` |
| `strokeWidth` | radice della cella | token `bordo.sottile` |
| `strokeStyle` | radice della cella | `dashed` |
| `strokeAlignment` | radice della cella | `center` |
| `borderRadiusTopLeft` | radice della cella | token `radius.md` |
| `borderRadiusTopRight` | radice della cella | token `radius.md` |
| `borderRadiusBottomRight` | radice della cella | token `radius.md` |
| `borderRadiusBottomLeft` | radice della cella | token `radius.md` |
| `paddingTop` | radice della cella | token `spacing.4` |
| `paddingRight` | radice della cella | token `spacing.6` |
| `paddingBottom` | radice della cella | token `spacing.4` |
| `paddingLeft` | radice della cella | token `spacing.6` |
| `rowGap` | radice della cella | token `spacing.2` |
| `columnGap` | `Riga` | token `spacing.2` |
| `fontSize` | `Testo` | token `text.lg` |
| `fontWeight` | `Testo` | token `peso.bold` |
| `letterSpacing` | `Testo` | token `tracking.wide` |
| `fontFamily` | `Testo` | token `font.sans` |
| `opacity` | `Assoluto` | token `opacity.meta` |
| `shadow` | radice della cella | token `shadow.sm` |
| `layoutDir` | radice della cella e `Riga` | `column` (radice), `row` (`Riga`) |
| `layoutAlign` | `Riga` (e `FlexNonToccato`) | `center` (`Riga`), `stretch` non toccato (`FlexNonToccato`) |
| `layoutJustify` | `Riga` | `space-between` |
| `layoutWrap` | `Riga` | `wrap` |
| `sizingH` | `Riga` (e `Pieno` di `FillDentroHug`) | `fill` |
| `sizingV` | `Riga` | `auto` (hug) |
| `x` | `Assoluto` | la sua posizione |
| `y` | `Assoluto` | la sua posizione |
| `width` | `Quadrato` | `16` |
| `height` | `Quadrato` | `16` |
| `position` | `Assoluto` | `absolute` |
| `constraintH` | `Assoluto` | `right` |
| `constraintV` | `Assoluto` | `bottom` |
| `clip` | radice della cella | *Clip content* attivo |
| `contract` | container `Collaudo` (e `CollaudoDoppione`) | `collaudo@1` |
| `part` | `Riga` | `riga` |
| `when` | `Testo` | `tono=primario` |
| `slot` | `Slot` | `contenuto` |
| `instance` | l'istanza di `Etichetta` in `Slot` | variante principale, nessun override |

Di `when` e `slot` si controlla solo che ci siano: il significato lo danno la 2.27 e la 2.29. Una voce nuova del registro va aggiunta al campione e a questa tabella; il test fallisce finché manca.

### Costruzione del campione

Il campione lo costruisce Claude via MCP Penpot sull'istanza di collaudo, mai sul Penpot vero: una cella per chiamata, con la conferma di Alessandro prima di ogni scrittura (layer, token e plugin data). Alessandro lo giudica a vista, poi lo esporta (*File → Export* → `.penpot`) in `packages/scripts/collaudo/campione.penpot`. Il primo collaudo verde sull'istanza nuova 2.18.3 è il riferimento.

## Esiti

| Controllo | Esito su 2.18.3 |
|---|---|
| "fill dentro hug" (`FillDentroHug`) | da registrare al primo collaudo: leggibile, e arriva come domanda `fillInHugH`? |
| default di `layoutAlign` su un flex non toccato | da registrare al primo collaudo (il registro dichiara `stretch`) |

Quali operazioni di Penpot cancellano i plugin data (raggruppa, booleana, copia tra file, ripristino di versione, stacco dell'istanza, duplica) non si misura qui: lo misura la Story 2.29 sul campione, prima che `pds-code` scriva plugin data.
