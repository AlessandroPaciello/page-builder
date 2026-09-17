# Contratto di estrazione — vocabolario

Companion di [SPEC.md](./SPEC.md) (CAP-2, CAP-3). Un file per componente in `packages/scripts`, che importa il contratto del page builder e dichiara come il componente si legge da Penpot e si rende. Esempio completo: [simulazione-card.md](../../forge/refactor-packages-scripts/simulazione-card.md).

## Forma

```ts
defineExtraction(<contratto page builder>, {
  penpot: { container: string },                 // plugin data = <name>@<version>, derivato
  render: { domain: string, headless: Headless | null },
  axes:   { [nome]: { type: "state" | "behavior", values, default } },
  parts:  { [nome]: Part },
  a11y:   { role: { [valore asse option]: string | null }, focusVisible: boolean, ariaAttributes?: string[] },
})
```

## Parte

| Campo | Obbligatorio | Significato | Regola |
|---|---|---|---|
| `role` | sì | `surface` · `text` · `icon` · `divider` · `image` | Decide le proprietà ammesse (registro). `image`: nessun `fill`. |
| `element` | sì | elemento HTML emesso | `root` con `attribute.href` → `a`. |
| `parent` | tutte tranne `root` | parte contenitrice | Albero con radice `root`, senza cicli. Da qui l'annidamento JSX. |
| `layer` | no | nome del layer Penpot, alias inclusi | Default: nome della parte in PascalCase. |
| `content` | no | field del page builder reso come testo della parte | Il field deve essere stringa. `"$item"` solo dentro `repeat`. |
| `attribute` | no | `{ attributoHtml: field }` | Il field deve avere il tipo dell'attributo (`src`, `href`: url). |
| `when` | no | `{ asse: [valori] }`: la parte esiste solo in quelle celle | Solo assi `option` del page builder. Presenza o assenza fuori regola = errore `contract`. |
| `repeat` | no | field array: la parte si ripete per elemento | Primo layer come modello; gli altri devono avere gli stessi token. |

## Headless

```ts
headless: { package: string, parts: { [parte]: string } }   // es. { root: "Item", trigger: "Trigger" }
```

Sostituisce la base shadcn: per ogni parte, il primitivo che ne diventa l'elemento. Libreria: Base UI (`@base-ui/react`).

## Controlli a module load

1. Ogni `content`/`attribute`/`repeat` nomina un field esistente con il tipo giusto.
2. `when` nomina assi `option` e valori esistenti; un asse di rendering è rifiutato.
3. `parent` forma un albero con radice `root`.
4. Ogni parte ha un ruolo del vocabolario; `partRoles` non esiste più nel page builder.
5. Il nome del contratto e la versione coincidono con il plugin data del container.

## Assi di rendering

`state` → prefissi del browser (`hover:`, `focus-visible:`, `aria-invalid:`, `disabled:`); `behavior` → `data-[state=…]:` dell'headless. Nessuna prop. Penpot li disegna come celle, come oggi l'Input; una cella mancante è errore `contract`.

## Registro proprietà (CAP-3)

Resta in `packages/scripts`, unico e globale. Nuove voci: `layout` (`dir`, `align`, `justify`, `gap`, `wrap`, dal `flex` del board) e `position` (da `layoutChild.absolute` + `parentX`/`parentY` + `zIndex`; `x`/`y` accettano un token di dimensione), lette dal layer Penpot per le parti `surface`/`image`. Tabella ruolo → proprietà invariata per `surface`, `text`, `icon`, `divider`; `image`: raggio, opacità, layout, posizione.
