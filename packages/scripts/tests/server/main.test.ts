import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { TOOL_NAMES } from "../../src/server/tools";
import { PATHS } from "../../src/shared/paths";

/**
 * L'entrypoint vero (`src/server/main.ts`) parte su stdio come lo avvia
 * `.mcp.json` (Story 2.24): `initialize` + `tools/list`, e lo stdout contiene
 * solo righe JSON-RPC. Nessun Penpot: `tools/list` non lo legge.
 */

const REQUESTS = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
];

describe("main.ts su stdio", () => {
  it("risponde a initialize e tools/list con i sei strumenti, stdout senza rumore", () => {
    const stdout = execFileSync(process.execPath, ["--import", "tsx", "src/server/main.ts"], {
      cwd: PATHS.packageRoot,
      encoding: "utf8",
      input: `${REQUESTS.map((request) => JSON.stringify(request)).join("\n")}\n`,
      timeout: 30_000,
    });
    const lines = stdout.split("\n").filter((line) => line !== "");
    const messages = lines.map((line) => JSON.parse(line) as { jsonrpc: string; id?: number; result?: { tools?: { name: string }[] } });
    expect(messages.every((message) => message.jsonrpc === "2.0")).toBe(true);
    expect(messages.map((message) => message.id)).toEqual([1, 2]);
    expect(messages[1]!.result!.tools!.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
  }, 40_000);
});
