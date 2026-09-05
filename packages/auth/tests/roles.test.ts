import { expect, it } from "vitest";

import { DEFAULT_ROLE, ROLES, parseRole } from "../src/roles";

it("espone la tassonomia di dominio AD-4: ADMIN | EDITOR | CLIENTE", () => {
  expect([...ROLES].sort()).toEqual(["ADMIN", "CLIENTE", "EDITOR"]);
  expect(DEFAULT_ROLE).toBe("CLIENTE");
});

it("accetta ogni valore della tassonomia e lo restituisce come tipo Role", () => {
  expect(parseRole("ADMIN")).toBe("ADMIN");
  expect(parseRole("EDITOR")).toBe("EDITOR");
  expect(parseRole("CLIENTE")).toBe("CLIENTE");
});

it("rifiuta valori fuori tassonomia con fail-fast (deny-by-default anche sulla forma del dato)", () => {
  for (const unknown of ["ADMIN ", "admin", "ROOT", "", "HACKER"]) {
    expect(() => parseRole(unknown)).toThrow();
  }
});

it("rifiuta valori mancanti/null-ish: un ruolo assente non è mai trattato come ammesso", () => {
  for (const missing of [undefined, null]) {
    expect(() => parseRole(missing as unknown as string)).toThrow();
  }
});
