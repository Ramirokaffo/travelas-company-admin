/**
 * Sérialisation CSV.
 *
 * Module pur, sans `server-only` : c'est du texte, testable isolément — et il
 * porte deux protections qui méritent de l'être.
 */

/** Point-virgule : Excel en configuration francophone lit la virgule comme séparateur décimal. */
export const CSV_SEPARATOR = ";";

/**
 * Marque d'ordre des octets.
 *
 * Sans elle, Excel interprète l'UTF-8 en Latin-1 : « Agence Béthel » devient
 * « Agence BÃ©thel ». Les autres tableurs l'ignorent silencieusement.
 */
export const CSV_BOM = "﻿";

/**
 * Échappe une valeur de cellule.
 *
 * Deux problèmes distincts, souvent confondus :
 *
 * 1. **le format** — un champ contenant le séparateur, un guillemet ou un saut
 *    de ligne doit être encadré de guillemets, ceux-ci étant doublés ;
 * 2. **l'injection de formule** — un tableur *exécute* une cellule commençant
 *    par `=`, `+`, `-` ou `@`. Un nom d'agence saisi par un utilisateur peut
 *    donc contenir `=HYPERLINK(...)` et exfiltrer le contenu du fichier à
 *    l'ouverture, sans que le CSV soit malformé pour autant. On préfixe d'une
 *    apostrophe, que les tableurs lisent comme « ceci est du texte ».
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Assemble un document CSV complet : BOM, en-tête, lignes, fins de ligne CRLF. */
export function toCsvDocument(
  header: readonly (string | number | null | undefined)[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
