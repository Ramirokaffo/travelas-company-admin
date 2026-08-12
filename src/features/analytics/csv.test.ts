import { describe, expect, it } from "vitest";

import { CSV_BOM, csvCell, toCsvDocument } from "./csv";

describe("csvCell", () => {
  it("laisse une valeur simple telle quelle", () => {
    expect(csvCell("Adjamé")).toBe("Adjamé");
    expect(csvCell(12500)).toBe("12500");
  });

  it("traite l'absence de valeur comme une cellule vide", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("encadre les valeurs contenant le séparateur ou un saut de ligne", () => {
    expect(csvCell("Gare ; Nord")).toBe('"Gare ; Nord"');
    expect(csvCell("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
  });

  it("double les guillemets internes", () => {
    expect(csvCell('Agence "Centrale"')).toBe('"Agence ""Centrale"""');
  });

  /**
   * Le cas qui justifie ce module : un tableur exécute une cellule commençant
   * par `=`, `+`, `-` ou `@`. Un nom d'agence est saisi par un utilisateur.
   */
  it("neutralise une formule de tableur", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  // Les deux protections se cumulent : la formule est désamorcée par
  // l'apostrophe, puis le champ est encadré parce qu'il contient des guillemets.
  it("cumule le désamorçage et l'échappement de format", () => {
    expect(csvCell('=HYPERLINK("http://exemple")')).toBe(
      '"\'=HYPERLINK(""http://exemple"")"',
    );
  });

  it("neutralise aussi une formule masquée par une tabulation de tête", () => {
    expect(csvCell("\t=1+1")).toBe("'\t=1+1");
  });

  // Un montant négatif est une valeur légitime : il est préfixé comme le reste,
  // ce qui le rend inoffensif sans le déformer visuellement.
  it("préfixe un nombre négatif sans en changer la lecture", () => {
    expect(csvCell(-1500)).toBe("'-1500");
  });
});

describe("toCsvDocument", () => {
  it("commence par le BOM et sépare les lignes en CRLF", () => {
    const document = toCsvDocument(["Date", "Agence"], [["2026-08-12", "Adjamé"]]);

    expect(document.startsWith(CSV_BOM)).toBe(true);
    expect(document).toBe(`${CSV_BOM}Date;Agence\r\n2026-08-12;Adjamé\r\n`);
  });

  it("produit un document lisible même sans aucune ligne", () => {
    expect(toCsvDocument(["Date"], [])).toBe(`${CSV_BOM}Date\r\n`);
  });
});
