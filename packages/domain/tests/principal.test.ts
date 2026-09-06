import { describe, expect, it } from "vitest";

import { isRole, ROLES } from "../src/principal";

describe("Principal (contratto canonico del core, AD-4)", () => {
  it("esporta la tassonomia dei ruoli: ADMIN | EDITOR | CLIENTE", () => {
    expect([...ROLES].sort()).toEqual(["ADMIN", "CLIENTE", "EDITOR"]);
  });

  it("isRole accetta ogni valore della tassonomia", () => {
    for (const role of ROLES) {
      expect(isRole(role)).toBe(true);
    }
  });

  it("isRole nega qualunque valore fuori tassonomia (deny-by-default sulla forma del dato)", () => {
    for (const unknown of ["admin", "ROOT", "", "ADMIN ", "HACKER", 42, null, undefined]) {
      expect(isRole(unknown)).toBe(false);
    }
  });
});
