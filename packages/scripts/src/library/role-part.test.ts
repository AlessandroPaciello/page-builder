import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { COMPONENT_CONTRACTS, fingerprintPayload, SCHEMA_VERSION, SECTION_DEFINITIONS } from "@app/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseRolePartArgs } from "../cli/role-part";
import { PATHS } from "../shared/paths";
import { sha256 } from "./adopt-variant";
import { planRolePart, readPartRole, runRolePart, setPartRoleInSource, type RolePartSources } from "./role-part";

/** Prova rosso/verde di `role:part` (Story 2.10, A): terzo adattamento, cambio compatibile. */

const alert = COMPONENT_CONTRACTS.alert;
const read = (path: string) => ({ path, text: readFileSync(path, "utf8") });
const sources = (): RolePartSources => ({
  contract: read(resolve(PATHS.contractsSrcDir, "components/alert.ts")),
  schemaVersion: read(resolve(PATHS.contractsSrcDir, "schema-version.ts")),
  fingerprint: read(PATHS.fingerprintPath),
});

describe("planRolePart", () => {
  it("cambia il ruolo nel sorgente, alza solo SCHEMA_VERSION e aggiunge la voce del fingerprint", () => {
    const plan = planRolePart(alert, "heading", "icon", sources());
    if (plan.kind !== "change") throw new Error(plan.message);
    expect(plan.files.map((file) => file.label)).toEqual(["contratto", "SCHEMA_VERSION", "fingerprint"]);
    expect(plan.schemaVersion).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION + 1 });
    const [contract, schema, fingerprint] = plan.files;
    expect(readPartRole(contract!.after, "alert.ts", "alert", "heading")).toBe("icon");
    expect(contract!.after).toContain(`version: 1,`);
    expect(contract!.after.replace(`heading: "icon"`, `heading: "text"`)).toBe(contract!.before);
    expect(schema!.after).toContain(`export const SCHEMA_VERSION = ${SCHEMA_VERSION + 1};`);
    const before = JSON.parse(fingerprint!.before) as Record<string, string>;
    const after = JSON.parse(fingerprint!.after) as Record<string, string>;
    for (const [version, hash] of Object.entries(before)) expect(after[version]).toBe(hash);
    const components = Object.values(COMPONENT_CONTRACTS).map((c) => (c.name === "alert" ? { ...c, partRoles: { ...c.partRoles, heading: "icon" as const } } : c));
    expect(after[String(SCHEMA_VERSION + 1)]).toBe(sha256(fingerprintPayload(components, Object.values(SECTION_DEFINITIONS))));
    expect(plan.changed.version).toBe(alert.version);
  });

  it("stesso ruolo → nessun cambio; parte o ruolo sconosciuti → errore nominativo", () => {
    expect(planRolePart(alert, "heading", "text", sources()).kind).toBe("nothing");
    expect(planRolePart(alert, "title", "text", sources())).toMatchObject({ kind: "error", message: expect.stringMatching(/la parte "title" non esiste/) });
    expect(planRolePart(alert, "heading", "label", sources())).toMatchObject({ kind: "error", message: expect.stringMatching(/Ruolo "label" non è nel vocabolario/) });
  });

  it("fingerprint già oltre la versione corrente → errore, non si riscrive una voce", () => {
    const broken = sources();
    const fingerprint = { ...broken.fingerprint, text: JSON.stringify({ ...JSON.parse(broken.fingerprint.text), [String(SCHEMA_VERSION + 1)]: "x" }) };
    expect(planRolePart(alert, "heading", "icon", { ...broken, fingerprint })).toMatchObject({ kind: "error", message: expect.stringMatching(/oltre la SCHEMA_VERSION/) });
  });

  it("setPartRoleInSource rispetta le virgolette; partRoles non letterale → errore", () => {
    const text = `defineContract({ name: 'x', partRoles: { root: 'surface' } })`;
    expect(setPartRoleInSource(text, "x.ts", "x", "root", "divider")).toBe(`defineContract({ name: 'x', partRoles: { root: 'divider' } })`);
    expect(() => readPartRole(`defineContract({ name: "x", partRoles: ROLES })`, "x.ts", "x", "root")).toThrow(/"partRoles" non è un oggetto letterale/);
  });
});

describe("runRolePart", () => {
  let root: string;
  let printed: string[];
  const print = (text: string): void => {
    printed.push(text);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "role-part-"));
    printed = [];
    mkdirSync(join(root, "components"));
    cpSync(resolve(PATHS.contractsSrcDir, "components/alert.ts"), join(root, "components/alert.ts"));
    cpSync(resolve(PATHS.contractsSrcDir, "schema-version.ts"), join(root, "schema-version.ts"));
    cpSync(PATHS.fingerprintPath, join(root, "fingerprint.json"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const paths = () => ({ contractsSrcDir: root, fingerprintPath: join(root, "fingerprint.json") });

  it("senza --yes stampa il diff e non scrive; con --yes scrive i tre file senza tmp residui", () => {
    const before = readFileSync(join(root, "components/alert.ts"), "utf8");
    expect(runRolePart({ component: "Alert", part: "heading", role: "icon", yes: false }, { paths: paths(), print })).toBe(0);
    expect(printed.join("\n")).toContain(`ruolo "text" → "icon", SCHEMA_VERSION ${SCHEMA_VERSION} → ${SCHEMA_VERSION + 1}`);
    expect(printed.join("\n")).toContain("Nessuna scrittura");
    expect(readFileSync(join(root, "components/alert.ts"), "utf8")).toBe(before);

    expect(runRolePart({ component: "Alert", part: "heading", role: "icon", yes: true }, { paths: paths(), print })).toBe(0);
    expect(readPartRole(readFileSync(join(root, "components/alert.ts"), "utf8"), "alert.ts", "alert", "heading")).toBe("icon");
    expect(readFileSync(join(root, "schema-version.ts"), "utf8")).toContain(`SCHEMA_VERSION = ${SCHEMA_VERSION + 1};`);
    expect(JSON.parse(readFileSync(join(root, "fingerprint.json"), "utf8"))).toHaveProperty(String(SCHEMA_VERSION + 1));
  });

  it("componente sconosciuto → errore nominativo", () => {
    expect(() => runRolePart({ component: "Nope", part: "root", role: "surface", yes: false }, { paths: paths(), print })).toThrow(
      /Contratto "Nope" non trovato nel registry/,
    );
  });
});

describe("parseRolePartArgs", () => {
  it("componente, parte, ruolo e --yes; argomenti mancanti o ignoti → errore d'uso", () => {
    expect(parseRolePartArgs(["--", "Alert", "heading", "icon", "--yes"])).toEqual({ component: "Alert", part: "heading", role: "icon", yes: true });
    expect(() => parseRolePartArgs(["Alert", "heading"])).toThrow(/Attesi componente, parte e ruolo/);
    expect(() => parseRolePartArgs(["Alert", "heading", "icon", "--dry"])).toThrow(/Argomento non riconosciuto: --dry/);
  });
});
