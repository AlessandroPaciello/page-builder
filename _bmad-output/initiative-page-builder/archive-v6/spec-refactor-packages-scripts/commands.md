# Comandi v2

Companion di [SPEC.md](./SPEC.md) (CAP-4..CAP-9). Sei comandi, un guscio, una classe di errore.

| Comando | Cosa fa | Live | In CI | Sostituisce |
|---|---|---|---|---|
| `theme [--live]` | Stadio 1 token, invariato | opzionale | no | `generate:theme` |
| `library bootstrap\|add [--dry-run]` | crea in Penpot container, assi, celle, layer dal contratto di estrazione | sì | no | `bootstrap:library`, `add:library` |
| `extract <Comp> [--check] [--snapshot <file>]` | Penpot → istantanea validata contro i due contratti; `--check` non scrive | sì | no | `extract:component`, `validate:recipe`, `verify:library`, `sync:design` |
| `render <Comp>\|--all [--check]` | istantanea + contratto di estrazione + registro → 4 file `@generated` | no | solo `--check` | `render:component`, `render:check` |
| `gates` | `render --check --all` + suite ui + axe, report per componente | no | sì | `gates:render` |
| `propose <Comp>` | Penpot davanti ai contratti: stampa il diff dei due contratti, non scrive | sì | no | `adopt:variant`, `bump:contract`, `role:part` |

## Stadi di `extract`

```
penpot → contract → parts → properties → write
```

Ogni stadio ha un nome nel log e una sola categoria di errore possibile. Un errore nomina componente, cella, parte, proprietà e token, e propone gli adattamenti nell'ordine designer → registro → contratto di estrazione (invariato dalla 2.10).

## Errore e uscita

```ts
class ScriptError { kind: "input" | "penpot" | "contract" | "gate"; component?; cell?; part?; detail: string }
```

| exit | kind | Esempio |
|---|---|---|
| 1 | `input` | argomento mancante, `--snapshot` duplicato |
| 2 | `penpot` | MCP irraggiungibile, timeout, container assente |
| 3 | `contract` | parte fuori `when`, token fuori ruolo, cella mancante |
| 4 | `gate` | diff in `render --check`, suite ui rossa |

Il guscio: un parser, la guardia di invocazione diretta, `main()` che restituisce il codice; nessun `process.exitCode` scritto altrove. `--all` accumula i fallimenti per componente e li elenca alla fine.

## Istantanea `data/components/<nome>.json`

Scritta solo da `extract`, tmp + rename. Contiene `contract`, `provenance` (id Penpot, `readAt`, hash) e `cells[cella][parte]` = token per proprietà più `layout`/`position`. Sostituisce fixture, ricetta e design. Il suo diff in PR è la review del design.
