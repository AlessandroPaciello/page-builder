import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn — tailwind-merge con le scale dei token Penpot (Story 2.9)", () => {
  it("un peso e una famiglia non sono in conflitto", () => {
    expect(cn("font-regular font-sans")).toBe("font-regular font-sans");
  });

  it("colore: vince l'ultimo, la dimensione del testo resta", () => {
    expect(cn("text-info text-sm", "text-destructive")).toBe("text-sm text-destructive");
  });

  it("tracking dei token: vince l'ultimo", () => {
    expect(cn("tracking-none", "tracking-tight")).toBe("tracking-tight");
  });
});
