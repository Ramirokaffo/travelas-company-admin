import { describe, expect, it } from "vitest";

import { ROUTES } from "@/constants/routes";
import { safeCallbackUrl } from "./safe-url";

describe("safeCallbackUrl", () => {
  it("accepte un chemin interne", () => {
    expect(safeCallbackUrl("/seats")).toBe("/seats");
    expect(safeCallbackUrl("/seats?page=2&q=abidjan")).toBe("/seats?page=2&q=abidjan");
  });

  it("prend la première valeur quand le paramètre est répété", () => {
    expect(safeCallbackUrl(["/staff", "/seats"])).toBe("/staff");
  });

  it("retombe sur le tableau de bord quand la valeur est absente ou vide", () => {
    expect(safeCallbackUrl(undefined)).toBe(ROUTES.dashboard);
    expect(safeCallbackUrl("")).toBe(ROUTES.dashboard);
    expect(safeCallbackUrl([])).toBe(ROUTES.dashboard);
  });

  // Cœur du test : chacun de ces cas serait une redirection ouverte.
  it.each([
    ["URL absolue", "https://phishing.example/login"],
    ["protocol-relative", "//phishing.example"],
    ["antislash", "/\\phishing.example"],
    ["schéma javascript", "javascript:alert(1)"],
    ["schéma data", "data:text/html,<script>alert(1)</script>"],
    ["chemin relatif", "seats"],
  ])("refuse une destination externe (%s)", (_label, value) => {
    expect(safeCallbackUrl(value)).toBe(ROUTES.dashboard);
  });

  it("refuse les caractères de contrôle", () => {
    expect(safeCallbackUrl("/seats\nSet-Cookie: x=1")).toBe(ROUTES.dashboard);
    expect(safeCallbackUrl("/\t/phishing.example")).toBe(ROUTES.dashboard);
  });

  it("accepte un repli explicite", () => {
    expect(safeCallbackUrl("https://phishing.example", ROUTES.login)).toBe(
      ROUTES.login,
    );
  });
});
