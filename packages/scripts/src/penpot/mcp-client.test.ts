import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  callPenpotTool,
  DEFAULT_PENPOT_MCP_URL,
  maskMcpUrl,
  resolveMcpEndpoint,
  withTimeout,
  type McpCallToolResult,
} from "./mcp-client";

// Client MCP finto: zero rete. Ogni test decide cosa fanno connect/callTool.
const fakeClient = vi.hoisted(() => ({
  connect: vi.fn<() => Promise<void>>(),
  callTool: vi.fn<() => Promise<McpCallToolResult>>(),
  close: vi.fn<() => Promise<void>>(),
}));
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn(function () {
    return fakeClient;
  }),
}));

describe("withTimeout", () => {
  it("risolve con il valore dell'operazione quando questa vince la race", async () => {
    await expect(withTimeout(Promise.resolve("ok"), "op", 50)).resolves.toBe("ok");
  });

  it("propaga il reject dell'operazione quando vince la race, senza loggare nulla", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(withTimeout(Promise.reject(new Error("boom")), "op", 50)).rejects.toThrow("boom");
    // L'operazione ha vinto la race (non è scaduto il timeout): nessun log diagnostico.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("rigetta con il messaggio di timeout quando l'operazione non risolve in tempo", async () => {
    const neverSettles = new Promise<never>(() => {
      /* mai risolta né rigettata entro il test */
    });
    await expect(withTimeout(neverSettles, "op-lenta", 20)).rejects.toThrow(/Timeout \(20ms\) su op-lenta/);
  });

  it("logga (senza unhandled rejection) il reject tardivo dell'operazione perdente dopo che il timeout ha già vinto", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let rejectLate: (error: Error) => void;
    const lateOperation = new Promise<never>((_, reject) => {
      rejectLate = reject;
    });

    await expect(withTimeout(lateOperation, "op-tardiva", 20)).rejects.toThrow(/Timeout \(20ms\) su op-tardiva/);

    // Il timeout ha già vinto la race quando l'operazione rigetta tardi.
    rejectLate!(new Error("connessione rifiutata in ritardo"));
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Rifiuto tardivo (dopo il timeout) su op-tardiva:"),
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});

const TOKEN = "s3cr3t-token";

async function rejectionOf(operation: Promise<unknown>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    return error as Error;
  }
  throw new Error("atteso un reject, l'operazione è riuscita");
}

describe("resolveMcpEndpoint", () => {
  it("senza variabili usa il default, senza userToken", () => {
    const endpoint = resolveMcpEndpoint({});
    expect(endpoint.url.toString()).toBe(DEFAULT_PENPOT_MCP_URL);
    expect(endpoint.url.searchParams.has("userToken")).toBe(false);
    expect(endpoint.hasToken).toBe(false);
  });

  it("con PENPOT_MCP_TOKEN aggiunge userToken e lo maschera in displayUrl", () => {
    const endpoint = resolveMcpEndpoint({ PENPOT_MCP_TOKEN: TOKEN });
    expect(endpoint.url.searchParams.get("userToken")).toBe(TOKEN);
    expect(endpoint.displayUrl).toBe(`${DEFAULT_PENPOT_MCP_URL}?userToken=***`);
    expect(endpoint.displayUrl).not.toContain(TOKEN);
    expect(endpoint.hasToken).toBe(true);
  });

  it("con PENPOT_MCP_URL custom preserva la query esistente e sovrascrive userToken", () => {
    const endpoint = resolveMcpEndpoint({ PENPOT_MCP_URL: "http://h:1/mcp?x=1&userToken=old", PENPOT_MCP_TOKEN: TOKEN });
    expect(endpoint.url.searchParams.get("x")).toBe("1");
    expect(endpoint.url.searchParams.getAll("userToken")).toEqual([TOKEN]);
  });

  it("tratta variabili vuote o solo spazi come assenti", () => {
    const endpoint = resolveMcpEndpoint({ PENPOT_MCP_URL: "", PENPOT_MCP_TOKEN: "  " });
    expect(endpoint.url.toString()).toBe(DEFAULT_PENPOT_MCP_URL);
    expect(endpoint.hasToken).toBe(false);
  });

  it("rifiuta un URL invalido nominando PENPOT_MCP_URL", () => {
    expect(() => resolveMcpEndpoint({ PENPOT_MCP_URL: "not-a-url" })).toThrow(/PENPOT_MCP_URL non è un URL http\(s\) valido/);
  });

  it("rifiuta un URL senza protocollo http(s), per esempio localhost:9001/mcp", () => {
    expect(() => resolveMcpEndpoint({ PENPOT_MCP_URL: "localhost:9001/mcp/stream" })).toThrow(/PENPOT_MCP_URL/);
  });

  it("non ripete nel messaggio un URL invalido che contiene userToken", () => {
    expect(() => resolveMcpEndpoint({ PENPOT_MCP_URL: `bad url?userToken=${TOKEN}` })).toThrow(/non mostrato/);
    try {
      resolveMcpEndpoint({ PENPOT_MCP_URL: `bad url?userToken=${TOKEN}` });
    } catch (error) {
      expect((error as Error).message).not.toContain(TOKEN);
    }
  });

  it("un userToken già presente in PENPOT_MCP_URL conta come token inviato", () => {
    const endpoint = resolveMcpEndpoint({ PENPOT_MCP_URL: `http://h:1/mcp?userToken=${TOKEN}` });
    expect(endpoint.hasToken).toBe(true);
    expect(endpoint.displayUrl).not.toContain(TOKEN);
  });
});

describe("maskMcpUrl", () => {
  it("lascia invariato un URL senza userToken", () => {
    expect(maskMcpUrl(new URL("http://h:1/mcp?x=1"))).toBe("http://h:1/mcp?x=1");
  });
});

describe("callPenpotTool", () => {
  const args = { name: "execute_code", arguments: { code: "return 1" } };

  beforeEach(() => {
    fakeClient.connect.mockReset().mockResolvedValue(undefined);
    fakeClient.callTool.mockReset();
    fakeClient.close.mockReset().mockResolvedValue(undefined);
  });

  it("restituisce il risultato del tool e chiude il client", async () => {
    const result = { content: [{ type: "text", text: '{"result":1}' }] };
    fakeClient.callTool.mockResolvedValue(result);
    await expect(callPenpotTool(resolveMcpEndpoint({}), args, "op")).resolves.toEqual(result);
    expect(fakeClient.close).toHaveBeenCalledTimes(1);
  });

  it("HTTP 401 senza token: chiede di impostare PENPOT_MCP_TOKEN", async () => {
    fakeClient.connect.mockRejectedValue(Object.assign(new Error("Streamable HTTP error"), { code: 401 }));
    await expect(callPenpotTool(resolveMcpEndpoint({}), args, "op")).rejects.toThrow(/esportalo come PENPOT_MCP_TOKEN/);
    expect(fakeClient.close).toHaveBeenCalledTimes(1);
  });

  it("HTTP 403 con token: dice che il token non è valido, senza mai stampare il token", async () => {
    fakeClient.connect.mockRejectedValue(Object.assign(new Error(`denied ${TOKEN}`), { code: 403 }));
    const error = await rejectionOf(callPenpotTool(resolveMcpEndpoint({ PENPOT_MCP_TOKEN: TOKEN }), args, "op"));
    expect(error.message).toMatch(/token in PENPOT_MCP_TOKEN non è valido/);
    expect(error.message).toContain("userToken=***");
    expect(error.message).not.toContain(TOKEN);
  });

  it("rifiuto testuale del tool senza token (multi-user): chiede di impostare PENPOT_MCP_TOKEN", async () => {
    fakeClient.callTool.mockResolvedValue({
      content: [{ type: "text", text: "Tool execution failed: Error: No userToken found in session context. Multi-user mode requires authentication." }],
    });
    await expect(callPenpotTool(resolveMcpEndpoint({}), args, "op")).rejects.toThrow(/esportalo come PENPOT_MCP_TOKEN/);
  });

  it("rifiuto testuale del tool con token: segnala token non valido o plugin non connesso", async () => {
    fakeClient.callTool.mockResolvedValue({
      content: [{ type: "text", text: "Tool execution failed: Error: No Penpot instance connected for user token." }],
    });
    const error = await rejectionOf(callPenpotTool(resolveMcpEndpoint({ PENPOT_MCP_TOKEN: TOKEN }), args, "op"));
    expect(error.message).toMatch(/riconnetti il plugin/);
    expect(error.message).not.toContain(TOKEN);
  });

  it("HTTP 404 (proxy MCP assente): nomina enable-mcp", async () => {
    fakeClient.connect.mockRejectedValue(Object.assign(new Error("Streamable HTTP error"), { code: 404 }));
    await expect(callPenpotTool(resolveMcpEndpoint({}), args, "op")).rejects.toThrow(/enable-mcp/);
  });

  it("riconosce il rifiuto anche se non è il primo content testuale", async () => {
    fakeClient.callTool.mockResolvedValue({
      content: [
        { type: "text", text: "preambolo" },
        { type: "text", text: "Tool execution failed: Error: No userToken found in session context." },
      ],
    });
    await expect(callPenpotTool(resolveMcpEndpoint({}), args, "op")).rejects.toThrow(/PENPOT_MCP_TOKEN/);
  });

  it("non scambia per rifiuto un risultato valido che contiene per caso il testo", async () => {
    const result = { content: [{ type: "text", text: '{"result":"No userToken found in session context"}' }] };
    fakeClient.callTool.mockResolvedValue(result);
    await expect(callPenpotTool(resolveMcpEndpoint({}), args, "op")).resolves.toEqual(result);
  });

  it("maschera anche la forma codificata del token e i throwable non Error", async () => {
    const special = "a+b/c=";
    const endpoint = resolveMcpEndpoint({ PENPOT_MCP_TOKEN: special });
    fakeClient.connect.mockRejectedValue(new Error(`fetch failed ${endpoint.url.toString()}`));
    const encoded = await rejectionOf(callPenpotTool(endpoint, args, "op"));
    expect(encoded.message).not.toContain(endpoint.url.searchParams.toString());
    expect(encoded.message).not.toContain(special);
    fakeClient.connect.mockRejectedValue(`stringa con ${special}`);
    const plain = await rejectionOf(callPenpotTool(endpoint, args, "op"));
    expect(String(plain)).not.toContain(special);
  });

  it("non resta appeso se la close non risponde", async () => {
    vi.useFakeTimers();
    fakeClient.callTool.mockResolvedValue({ content: [] });
    fakeClient.close.mockReturnValue(new Promise<void>(() => {}));
    const pending = callPenpotTool(resolveMcpEndpoint({}), args, "op");
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toEqual({ content: [] });
    vi.useRealTimers();
  });

  it("maschera il token anche negli errori non di autenticazione", async () => {
    fakeClient.connect.mockRejectedValue(new Error(`fetch failed for http://localhost:9001/mcp/stream?userToken=${TOKEN}`));
    const error = await rejectionOf(callPenpotTool(resolveMcpEndpoint({ PENPOT_MCP_TOKEN: TOKEN }), args, "op"));
    expect(error.message).toContain("fetch failed");
    expect(error.message).not.toContain(TOKEN);
  });
});
