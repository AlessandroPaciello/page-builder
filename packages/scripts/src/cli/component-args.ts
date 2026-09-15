import type { BumpArgs } from "../library/bump-command";

/** Parsing condiviso da `bump:contract` e `adopt:variant`: `<Comp> [--dry-run | --yes] [--snapshot <path>]`. */
export function parseComponentArgs(args: readonly string[], usage: string): BumpArgs {
  const rest = args.filter((arg) => arg !== "--");
  let component: string | undefined;
  let yes = false;
  let dryRun = false;
  let snapshotPath: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index]!;
    if (arg === "--yes") yes = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--snapshot") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Opzione --snapshot richiede un percorso file.");
      snapshotPath = value;
      index++;
    } else if (arg.startsWith("--")) {
      throw new Error(`Argomento non riconosciuto: ${arg} — ${usage}.`);
    } else if (component === undefined) {
      component = arg;
    } else {
      throw new Error(`Un solo componente per volta: ricevuti "${component}" e "${arg}" — ${usage}.`);
    }
  }
  if (component === undefined) throw new Error(`Componente mancante — ${usage}.`);
  if (yes && dryRun) throw new Error("--yes e --dry-run sono alternativi: senza --yes non si scrive comunque.");
  // `--snapshot` è il seam offline della SOLA lettura: pianificare su un file
  // e scrivere sul Penpot live disallineerebbe piano e scrittura.
  if (yes && snapshotPath !== undefined) throw new Error("--snapshot è valido solo senza --yes (sola lettura).");
  return { component, yes, snapshotPath };
}
