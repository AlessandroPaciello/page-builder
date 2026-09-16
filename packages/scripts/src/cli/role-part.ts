import { runRolePart, type RolePartArgs } from "../library/role-part";
import { isDirectInvocation } from "../shared/direct-invocation";

/**
 * Entry CLI di `role:part` (Story 2.10, A): parsing, guardia e `main`. La
 * logica è in `src/library/role-part.ts`.
 *
 *   role:part -- <Comp> <parte> <ruolo> [--yes]
 */

const USAGE = "uso: pnpm role:part -- <Comp> <parte> <ruolo> [--yes]";

export function parseRolePartArgs(args: readonly string[]): RolePartArgs {
  const rest = args.filter((arg) => arg !== "--");
  const positional: string[] = [];
  let yes = false;
  for (const arg of rest) {
    if (arg === "--yes") yes = true;
    else if (arg.startsWith("--")) throw new Error(`Argomento non riconosciuto: ${arg} — ${USAGE}.`);
    else positional.push(arg);
  }
  if (positional.length !== 3) {
    throw new Error(`Attesi componente, parte e ruolo (ricevuti ${positional.length} argomenti: [${positional.join(", ")}]) — ${USAGE}.`);
  }
  const [component, part, role] = positional as [string, string, string];
  return { component, part, role, yes };
}

if (isDirectInvocation(import.meta.url)) {
  try {
    process.exit(runRolePart(parseRolePartArgs(process.argv.slice(2))));
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
