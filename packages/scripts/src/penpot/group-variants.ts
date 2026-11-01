import { GroupVariantsResult, VariantCellsReading, groupVariantsResult, type GroupVariantsPlan, type GroupVariantsPlanner } from "../core";
import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint, type McpCallToolResult, type McpEndpoint } from "./mcp-client";

/**
 * Adattatore Penpot `groupVariants` (Story 2.36): l'unico punto che scrive sul
 * file Penpot. Esegue in due chiamate `execute_code`:
 *
 * 1. {@link READ_VARIANT_CELLS_SOURCE}, che non scrive niente: le celle sciolte
 *    `Component / Axis=Value` e il container che già raggruppa il componente;
 * 2. dopo la validazione del nucleo (`planGroupVariants`), {@link
 *    GROUP_VARIANTS_SOURCE}, che raggruppa le celle in un container di varianti
 *    e imposta gli assi.
 *
 * Un set parziale o un nome incompleto ferma la prima fase: la seconda non
 * parte, quindi nessuna scrittura. Non si scrivono mai plugin data `pagebuilder`
 * (li scrive `pds-code`) né token.
 */

/** Namespace degli shared plugin data del page builder: si legge, non si scrive. */
const NAMESPACE = "pagebuilder";

/**
 * Eseguito dentro il plugin Penpot. Definisce `readVariantCells(name)`, che
 * restituisce `{ reading }` oppure `{ error }`: il container che già raggruppa
 * il componente, oppure le celle sciolte da raggruppare. Non scrive niente.
 */
export const READ_VARIANT_CELLS_SOURCE = `
const NAMESPACE = ${JSON.stringify(NAMESPACE)};

// Stesse regole di kebabOf (src/core/naming.ts).
function kebab(name) {
  return String(name)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-");
}
function matches(value, name) {
  return typeof value === "string" && (value === name || kebab(value) === name);
}
function contractMatches(contract, name) {
  return typeof contract === "string" && (contract === name || contract.startsWith(name + "@"));
}
function isVariantContainer(shape) {
  try {
    return typeof shape.isVariantContainer === "function" && shape.isVariantContainer();
  } catch (error) {
    return false;
  }
}
function contractOf(shape) {
  try {
    const value = shape.getSharedPluginData(NAMESPACE, "contract");
    return typeof value === "string" ? value : "";
  } catch (error) {
    return "";
  }
}
function labelOf(name) {
  const slash = String(name).indexOf("/");
  return slash < 0 ? "" : String(name).slice(0, slash).trim();
}
function variantsOf(container) {
  const list = container && container.variants ? container.variants.variantComponents() : [];
  const out = [];
  for (const component of list || []) {
    let main = null;
    try {
      main = component.mainInstance();
    } catch (error) {
      main = null;
    }
    if (!main) continue;
    const variant = { id: main.id, name: main.name, variant: JSON.parse(JSON.stringify(component.variantProps || {})) };
    if (component.variantError) variant.variantError = String(component.variantError);
    out.push(variant);
  }
  return out;
}
// L'ordine delle proprietà è quello di variantProps (le proprietà della
// variante), non l'elenco \`properties\` di Variants, che è un insieme senza ordine.
function axesOf(variants) {
  if (variants.length === 0) return [];
  return Object.keys(variants[0].variant || {});
}
function readVariantCells(name) {
  try {
    const components = penpot.library.local.components || [];
    const targets = [];
    const byId = new Map();
    const available = [];
    for (const component of components) {
      let main = null;
      try {
        main = component.mainInstance();
      } catch (error) {
        main = null;
      }
      if (!main) continue;
      if (available.indexOf(main.name) < 0) available.push(main.name);
      const target = main.parent && isVariantContainer(main.parent) ? main.parent : main;
      if (byId.has(target.id)) continue;
      byId.set(target.id, target);
      targets.push(target);
    }

    const containers = targets.filter(function (target) {
      if (!isVariantContainer(target)) return false;
      return contractMatches(contractOf(target), name) || matches(target.name, name);
    });
    if (containers.length > 1) {
      return { error: 'Più componenti rispondono a "' + name + '": [' + containers.map(function (target) { return target.name; }).join(", ") + "]. Un contratto (o un nome) deve indicare un componente solo." };
    }
    const container = containers[0];
    if (container) {
      const variants = variantsOf(container);
      return {
        reading: {
          component: name,
          container: { id: container.id, name: container.name, properties: axesOf(variants), variants: variants },
          boards: [],
          available: available,
        },
      };
    }

    const boards = targets
      .filter(function (target) {
        if (isVariantContainer(target)) return false;
        if (contractMatches(contractOf(target), name) || matches(target.name, name)) return true;
        const label = labelOf(target.name);
        return label.length > 0 && matches(label, name);
      })
      .map(function (target) {
        return { id: target.id, name: target.name };
      });

    return { reading: { component: name, boards: boards, available: available } };
  } catch (error) {
    return { error: 'Lettura delle celle di "' + name + '" fallita in Penpot: ' + (error && error.message ? error.message : String(error)) };
  }
}
`;

/**
 * Eseguito dentro il plugin Penpot. Riceve il piano del nucleo e raggruppa le
 * celle con \`penpot.createVariantFromComponents\` (la stessa operazione del
 * comando «Combine as variants» di Penpot, che nasce senza variante automatica),
 * poi rinomina le proprietà sui nomi degli assi e imposta i valori di ogni
 * cella. Ogni mutazione di Penpot è asincrona: si attende lo stato atteso prima
 * del passo successivo, e alla fine si controlla il risultato.
 */
export const GROUP_VARIANTS_SOURCE = `
const PLAN = __PLAN__;
const POLL_MS = 50;
const STEP_TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}
async function waitFor(what, read) {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  for (;;) {
    let value = null;
    try {
      value = read();
    } catch (error) {
      value = null;
    }
    if (value) return value;
    if (Date.now() > deadline) throw new Error("group_variants: " + what + " non è arrivato entro " + STEP_TIMEOUT_MS + "ms: il raggruppamento non si completa.");
    await sleep(POLL_MS);
  }
}
function propsOf(container) {
  const list = container && container.variants ? container.variants.variantComponents() : [];
  if (!list || list.length === 0) return null;
  return list[0].variantProps || {};
}
function variantMap(container, cells) {
  const map = new Map();
  const list = container && container.variants ? container.variants.variantComponents() : [];
  for (const component of list || []) {
    let main = null;
    try {
      main = component.mainInstance();
    } catch (error) {
      main = null;
    }
    if (main) map.set(main.id, component);
  }
  const missing = cells.filter(function (cell) {
    return !map.has(cell.id);
  }).map(function (cell) {
    return cell.name;
  });
  if (missing.length > 0) throw new Error("group_variants: le varianti " + JSON.stringify(missing) + " non sono nel container: gli assi non si impostano.");
  return map;
}
async function groupVariants() {
  if (typeof penpot.createVariantFromComponents !== "function") {
    throw new Error("group_variants: questa versione di Penpot non ha createVariantFromComponents (serve Penpot 2.18 o successiva): il raggruppamento non parte.");
  }
  const page = penpot.currentPage;
  const boards = PLAN.cells.map(function (cell) {
    const shape = page ? page.getShapeById(cell.id) : null;
    if (!shape) {
      throw new Error('group_variants: la cella "' + cell.name + '" (id ' + cell.id + ") non è nella pagina corrente: il raggruppamento non parte.");
    }
    return shape;
  });

  const container = penpot.createVariantFromComponents(boards);
  const variants = await waitFor("la creazione del container di varianti", function () {
    if (!container || !container.isVariantContainer()) return null;
    const list = container.variants ? container.variants.variantComponents() : [];
    if (!list || list.length !== PLAN.cells.length) return null;
    // La prima proprietà nasce con la creazione: senza, renameProperty(0) non farebbe niente.
    const props = list[0].variantProps || {};
    return Object.keys(props).length >= 1 ? list : null;
  });
  const byBoard = variantMap(container, PLAN.cells);

  // Il container prende il nome del componente (è il prefisso comune delle
  // celle: senza, Penpot creerebbe il wrapper «Component»).
  if (container.name !== PLAN.containerName) container.name = PLAN.containerName;

  // Gli assi: la prima proprietà nasce con il nome generico di Penpot
  // («Property 1»), le altre si aggiungono. renameProperty/addProperty passano
  // dal file, quindi si attende che la proprietà esista e abbia il nome giusto.
  const axes = PLAN.axes;
  container.variants.renameProperty(0, axes[0]);
  await waitFor('la rinomina dell\\'asse "' + axes[0] + '"', function () {
    const props = propsOf(container);
    return props !== null && Object.keys(props)[0] === axes[0];
  });
  for (let i = 1; i < axes.length; i += 1) {
    container.variants.addProperty();
    await waitFor('la creazione dell\\'asse "' + axes[i] + '"', function () {
      const props = propsOf(container);
      return props !== null && Object.keys(props).length === i + 1;
    });
    container.variants.renameProperty(i, axes[i]);
    await waitFor('la rinomina dell\\'asse "' + axes[i] + '"', function () {
      const props = propsOf(container);
      return props !== null && Object.keys(props)[i] === axes[i];
    });
  }

  for (const cell of PLAN.cells) {
    const component = byBoard.get(cell.id);
    for (let i = 0; i < axes.length; i += 1) component.setVariantProperty(i, cell.variant[axes[i]]);
  }

  // Il risultato si legge dal file, non si presume: nessun variantError, tutte
  // le varianti con i valori del piano.
  return await waitFor("il container di varianti con gli assi impostati", function () {
    const list = container.variants ? container.variants.variantComponents() : [];
    if (!list || list.length !== PLAN.cells.length) return null;
    const out = [];
    for (const component of list) {
      if (component.variantError) return null;
      const props = JSON.parse(JSON.stringify(component.variantProps || {}));
      const ids = Object.keys(props);
      if (ids.length !== axes.length) return null;
      for (let i = 0; i < axes.length; i += 1) if (ids[i] !== axes[i]) return null;
      let main = null;
      try {
        main = component.mainInstance();
      } catch (error) {
        main = null;
      }
      if (!main) return null;
      const cell = PLAN.cells.find(function (candidate) {
        return candidate.id === main.id;
      });
      if (!cell) return null;
      for (let i = 0; i < axes.length; i += 1) if (props[axes[i]] !== cell.variant[axes[i]]) return null;
      out.push({ name: main.name, variant: props });
    }
    return out;
  }).then(function (cells) {
    return { outcome: "raggruppato", component: PLAN.component, container: container.name, axes: axes, cells: cells };
  });
}
`;

export type CallToolFn = (args: { name: string; arguments: { code: string } }) => Promise<McpCallToolResult>;

export interface GroupVariantsOptions {
  /** Di default `resolveMcpEndpoint()` (PENPOT_MCP_URL / PENPOT_MCP_TOKEN), risolto alla chiamata. */
  endpoint?: McpEndpoint;
  /** Punto di iniezione per i test: niente rete. In produzione è assente. */
  callTool?: CallToolFn;
  timeoutMs?: number;
}

/** Raggruppare un componente di dodici celle è più lento del timeout di default del client. */
export const GROUP_VARIANTS_TIMEOUT_MS = 60_000;

/** Il codice eseguito in Penpot per leggere le celle del componente `component`. */
export function readVariantCellsCode(component: string): string {
  return `${READ_VARIANT_CELLS_SOURCE}\nreturn readVariantCells(${JSON.stringify(component)});\n`;
}

/** Il codice eseguito in Penpot per scrivere il piano (nessun altro ingresso). */
export function groupVariantsCode(plan: GroupVariantsPlan): string {
  if (plan.container === undefined) throw new Error("groupVariantsCode: il piano non ha il nome del container.");
  if (plan.axes.length === 0) throw new Error("groupVariantsCode: il piano non ha assi.");
  const payload = {
    component: plan.component,
    containerName: plan.container,
    axes: [...plan.axes],
    cells: plan.cells.map((cell) => ({ id: cell.id, name: cell.name, variant: { ...cell.variant } })),
  };
  return `${GROUP_VARIANTS_SOURCE.replace("__PLAN__", () => JSON.stringify(payload))}\nreturn groupVariants();\n`;
}

function what(component: string, phase: string): string {
  return `${phase} del componente "${component}"`;
}

async function execute<T>(
  component: string,
  phase: string,
  code: string,
  options: GroupVariantsOptions,
  parse: (payload: unknown) => T,
): Promise<T> {
  const callTool =
    options.callTool ??
    ((args) => callPenpotTool(options.endpoint ?? resolveMcpEndpoint(), args, `execute_code (${what(component, phase)})`, options.timeoutMs ?? GROUP_VARIANTS_TIMEOUT_MS));
  const result = await callTool({ name: "execute_code", arguments: { code } });
  const envelope = parseExecuteCodeEnvelope(result, what(component, phase));
  const payload = envelope.result as { error?: unknown } | null;
  if (payload !== null && typeof payload === "object" && typeof payload.error === "string") throw new Error(payload.error);
  return parse(payload);
}

/**
 * Raggruppa le celle di `component` in un container di varianti. La lettura
 * (`readVariantCells`) non scrive; il piano del nucleo (`plan`) valida le celle
 * e decide: con `write: false` non si chiama Penpot una seconda volta, quindi
 * `già raggruppato` e `singolo` sono idempotenti e senza effetti.
 */
export async function groupVariants(component: string, plan: GroupVariantsPlanner, options: GroupVariantsOptions = {}): Promise<GroupVariantsResult> {
  if (component.trim().length === 0) throw new Error("groupVariants: il nome del componente è vuoto.");
  const reading = await execute(component, "lettura delle celle", readVariantCellsCode(component), options, (payload) => {
    const parsed = (payload as { reading?: unknown } | null)?.reading;
    if (parsed === undefined) throw new Error(`La risposta di execute_code non contiene né "reading" né "error" — ${what(component, "lettura delle celle")}: ${JSON.stringify(payload)?.slice(0, 200)}`);
    const validated = VariantCellsReading.safeParse(parsed);
    if (!validated.success) {
      const issues = validated.error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(radice)"}: ${issue.message}`);
      throw new Error(`La lettura delle celle di "${component}" non passa lo schema — ${issues.join("; ")}`);
    }
    return validated.data;
  });

  // Il piano: se lancia, non si scrive niente.
  const decision = plan(reading);
  if (!decision.write) return groupVariantsResult(decision);

  const written = await execute(component, "raggruppamento in varianti", groupVariantsCode(decision), options, (payload) => parseResult(payload, component));
  // Le combinazioni non disegnate le conosce il piano, non Penpot.
  return decision.notDrawn === undefined ? written : { ...written, notDrawn: [...decision.notDrawn] };
}

/** L'uscita del sorgente di scrittura: `{ outcome, component, container, axes, cells }`. */
function parseResult(payload: unknown, component: string): GroupVariantsResult {
  const parsed = GroupVariantsResult.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(radice)"}: ${issue.message}`);
    throw new Error(`Il risultato del raggruppamento di "${component}" non passa lo schema — ${issues.join("; ")}`);
  }
  return parsed.data;
}
