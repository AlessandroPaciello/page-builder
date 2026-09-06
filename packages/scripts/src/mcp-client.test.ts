import { describe, expect, it, vi } from "vitest";

import { withTimeout } from "./mcp-client";

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
