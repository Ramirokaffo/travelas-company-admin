import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, isTheme, parseTheme, themeClassName } from "./theme";

describe("parseTheme", () => {
  it("accepte les trois réglages", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  // Le cookie de thème est écrit par le navigateur : une valeur forgée ne doit
  // pas finir en nom de classe sur `<html>`.
  it("retombe sur « système » pour toute valeur inconnue", () => {
    expect(parseTheme("solarized")).toBe(DEFAULT_THEME);
    expect(parseTheme("")).toBe(DEFAULT_THEME);
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme("dark onload=alert(1)")).toBe(DEFAULT_THEME);
  });
});

describe("isTheme", () => {
  it("ne reconnaît que les valeurs du contrat", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("Dark")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe("themeClassName", () => {
  it("traduit un choix explicite en classe", () => {
    expect(themeClassName("light")).toBe("light");
    expect(themeClassName("dark")).toBe("dark");
  });

  /**
   * Le point clé du dispositif : « Système » ne pose *aucune* classe. C'est
   * cette absence qui laisse `prefers-color-scheme` décider, côté CSS comme
   * côté variante Tailwind `dark:`. Poser une classe ici figerait le thème.
   */
  it("ne pose aucune classe pour le réglage « système »", () => {
    expect(themeClassName("system")).toBeUndefined();
  });
});
