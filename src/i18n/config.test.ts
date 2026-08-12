import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, isLocale, negotiateLocale, parseLocale } from "./config";

describe("parseLocale", () => {
  it("accepte les langues prises en charge", () => {
    expect(parseLocale("fr")).toBe("fr");
    expect(parseLocale("en")).toBe("en");
  });

  // Le cookie de langue est écrit par le navigateur : sa valeur n'est jamais
  // digne de confiance, et une valeur forgée ne doit pas casser le rendu.
  it("retombe sur la langue par défaut pour toute valeur inconnue", () => {
    expect(parseLocale("de")).toBe(DEFAULT_LOCALE);
    expect(parseLocale("")).toBe(DEFAULT_LOCALE);
    expect(parseLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(parseLocale("../../etc/passwd")).toBe(DEFAULT_LOCALE);
  });
});

describe("isLocale", () => {
  it("ne reconnaît que les deux langues du catalogue", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("es")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("negotiateLocale", () => {
  it("retient la langue de plus fort poids", () => {
    expect(negotiateLocale("en-US,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(negotiateLocale("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
  });

  // Le poids prime sur l'ordre d'apparition.
  it("respecte les poids même mal ordonnés", () => {
    expect(negotiateLocale("fr;q=0.2,en;q=0.9")).toBe("en");
  });

  it("ignore les langues non prises en charge", () => {
    expect(negotiateLocale("de-DE,de;q=0.9,en;q=0.5")).toBe("en");
    expect(negotiateLocale("de,es,it")).toBe(DEFAULT_LOCALE);
  });

  it("rattache une sous-balise régionale à sa langue", () => {
    expect(negotiateLocale("en-GB")).toBe("en");
    expect(negotiateLocale("fr-CI")).toBe("fr");
  });

  it("retombe sur la langue par défaut sans en-tête exploitable", () => {
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale("")).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale("*")).toBe(DEFAULT_LOCALE);
  });
});
