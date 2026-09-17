# Forged idea: pipeline Penpot→codice v2 (ex "refactor di packages/scripts")

Forgiata il 2026-09-16. Il refactor degli script è diventato una v2 del modello; gli script ne discendono.
Simulazione di riferimento: `simulazione-card.md` (stessa cartella).

## Locked

- **Due contratti, dipendenza in una sola direzione.**
  - Page builder (`@app/contracts`, nel fingerprint): `name`, `version`, assi `option`, `fields` (testo, attributo, url, array), slot. Regola: ci sta solo ciò che cambia una pagina salvata o un campo dell'editor.
  - Estrazione (`packages/scripts`, importa ed estende il primo, fallisce a module load se lo contraddice): assi `state`/`behavior`, parti con ruolo (nuovo ruolo `image`), `when` (parte opzionale per valore di asse option), `repeat` (parte ripetibile su field array), `parent` (albero), `layer`/alias, `element`, `content`/`attribute` verso i field, `headless` per parte, dominio, a11y con role per variante, container Penpot.
  - `parts` e assi `state`/`behavior` escono dal contratto del page builder → `SCHEMA_VERSION` sale ora, finché costa zero pagine.
- **Sostituiti da questo:** `judgments/`, `bindings/`, `designs/`, `bases/`, coppia fixture+ricetta.
- **Istantanea** `data/components/<nome>.json`: scritta solo da `extract`, mai a mano. Serve a `render` offline, alla rigenerazione dopo cambi al registro, alla review del diff di design. `extract --check` confronta Penpot live senza scrivere.
- **Registro proprietà** resta unico e globale: l'unico posto dove si insegna un token. Impara `layout`, `align`, `gap`, `position` (letti da Penpot: niente classi Tailwind a mano). Ruolo `image`: nessun `fill`, unica eccezione alla regola "token su ogni stile".
- **shadcn esce.** La base si riduce al primitivo headless per parte (`headless: null` per chi non ne ha). Radix vs Base UI: deep recon tecnico separato, provato sull'Accordion.
- **Sei comandi**: `theme`, `library`, `extract`, `render`, `gates`, `propose` (fonde `adopt:variant`, `bump:contract`, `role:part`; stampa il diff dei contratti, il dev lo applica). Un guscio CLI, una `ScriptError { kind, component, cell?, part?, detail }` con exit `1 input / 2 penpot / 3 contract / 4 gate`, mai `process.exitCode` globale.
- **Testo del badge per variante** (`Offerta`/`Sconto`): field `badgeLabel` del page builder, modificabile dall'editor.
- **Ordine**: la ProductCard è il primo componente della v2; i quattro v1 restano in v1 finché la card non passa, poi migrano; poi si cancella la v1 e si riscrivono le skill `pds-*` (citano i comandi per nome: `verify:library` 26 volte).
- **Regressione v1→v2**: diff zero impossibile per costruzione; per ogni componente migrato valgono test generati + axe + confronto visivo in Storybook, una volta sola. Dopo, diff zero in CI come oggi. La card: diff zero dal primo commit; primo giudizio visivo di Alessandro.
- **Criterio di accettazione della v2**: la ProductCard passa da Penpot a `packages/ui` senza codice a mano.

## Rejected

- Refactor di sola visibilità delle pipe v1: la sequenza non era esagerata (8 stadi), ma non riduce il rischio sui nuovi casi di design, che stanno nel modello.
- Contratto del page builder che conosce Penpot: Puck dipenderebbe dal design, fingerprint sporco.
- Classi Tailwind a mano (`structural`) nel contratto di estrazione: tornerebbero con un altro nome.
- Basi shadcn: file inerti, l'emitter le usava solo per import e confronto.
- Badge per primo: Alessandro preferisce provare il modello sul caso più difficile.

## Open (per la spec)

- `repeat`: primo layer come modello, gli altri identici; va detto al designer nella skill.
- Story 2.11 e 2.12 stanno sopra la v1: serve correct-course; Storybook (2.12) diventa utile prima della migrazione.
- Convivenza v1/v2 in CI per la durata della migrazione.
- Deriva Penpot senza `extract`: non risolta dalla v2, `extract --check` schedulato è un'altra storia.
