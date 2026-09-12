import type { PenpotTokenValue, TokenType } from "../theme-generator";

/**
 * Snapshot serializzabile della library Penpot locale (Story 2.4, Task 4):
 * è il contratto fra ciò che legge Penpot (`library-reader.ts`, via MCP) e
 * ciò che decide offline (`library-plan.ts`, `verify-library.ts`). Nessuna
 * funzione, nessun riferimento a shape live: solo dati JSON.
 */

export interface SnapshotToken {
  name: string;
  type: TokenType;
  value: PenpotTokenValue;
}

export interface SnapshotSet {
  name: string;
  active: boolean;
  tokens: SnapshotToken[];
}

/**
 * Un layer dell'albero di una cella. `style` contiene SOLO le proprietà di
 * stile "valorizzate" (fills/strokes non vuoti, radius > 0, opacity ≠ 1,
 * padding/gap > 0, proprietà testo sempre): è l'insieme su cui la regola 7
 * di `verifyLibrary` esige un binding in `tokens`. La geometria dei path è
 * esclusa per AD-11 ("geometria delle icone ignorata").
 */
export interface SnapshotLayer {
  name: string;
  kind: string;
  /** `shape.tokens`: proprietà → nome token. */
  tokens: Record<string, string>;
  /** Proprietà di stile valorizzate (valori grezzi letti da Penpot). */
  style: Record<string, unknown>;
  children: SnapshotLayer[];
}

export interface SnapshotCell {
  /** Valori degli assi per questa cella; `null` per l'istanza main ("Default"). */
  variantProps: Record<string, string> | null;
  variantError: string | null;
  /** La board della cella con il suo albero di layer. */
  root: SnapshotLayer;
}

export interface SnapshotComponent {
  id: string;
  name: string;
  /** `getSharedPluginData("pagebuilder", "contract")`: `nome@versione` o null. */
  pluginData: string | null;
  /** `variants.properties`, nell'ordine del container. */
  axes: string[];
  /** `currentValues` per ogni proprietà d'asse. */
  axesValues: Record<string, string[]>;
  cells: SnapshotCell[];
}

export interface LibrarySnapshot {
  /** Tutti i set di token di `library.local` (attivi e non). */
  sets: SnapshotSet[];
  /** Numero TOTALE di componenti di `library.local`, varianti o meno. */
  componentCount: number;
  /** I VariantContainer trovati (unicamente quelli). */
  components: SnapshotComponent[];
}

/** Snapshot vuoto: l'unico stato su cui il bootstrap non rifiuta. */
export function emptySnapshot(): LibrarySnapshot {
  return { sets: [], componentCount: 0, components: [] };
}
