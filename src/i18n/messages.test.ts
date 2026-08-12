import { describe, expect, it } from "vitest";

import en from "./messages/en.json";
import fr from "./messages/fr.json";

/**
 * Garde-fou contre la dérive des catalogues.
 *
 * Une clé ajoutée d'un seul côté ne casse rien au build : next-intl affiche le
 * chemin de la clé à la place du texte. L'anomalie ne se voit donc qu'en
 * naviguant dans l'autre langue — c'est-à-dire rarement. Ces tests la font
 * remonter au moment où elle est introduite.
 */

type Catalog = Record<string, unknown>;

/** Aplatit un catalogue en chemins de clés (`staff.form.email`). */
function flatten(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];

  return Object.entries(value as Catalog).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

/** Noms des variables ICU d'un message (`{name}`, `{from}`…). */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)/g)].map((match) => match[1] ?? "").sort();
}

function messageAt(catalog: Catalog, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Catalog | undefined)?.[key],
      catalog as unknown,
    );
}

const frKeys = flatten(fr).sort();
const enKeys = flatten(en).sort();

describe("catalogues de langue", () => {
  it("expose exactement les mêmes clés en français et en anglais", () => {
    expect(enKeys).toEqual(frKeys);
  });

  it("ne contient aucun message vide", () => {
    for (const [name, catalog] of [
      ["fr", fr],
      ["en", en],
    ] as const) {
      for (const key of flatten(catalog)) {
        const message = messageAt(catalog as unknown as Catalog, key);
        expect(typeof message, `${name}.${key}`).toBe("string");
        expect(String(message).trim(), `${name}.${key}`).not.toBe("");
      }
    }
  });

  // Une variable oubliée dans une traduction s'affiche telle quelle
  // (« Bonjour {firstName} ») ; une variable inventée fait lever next-intl.
  it("emploie les mêmes variables ICU dans les deux langues", () => {
    for (const key of frKeys) {
      const frMessage = String(messageAt(fr as unknown as Catalog, key));
      const enMessage = String(messageAt(en as unknown as Catalog, key));
      expect(placeholders(enMessage), key).toEqual(placeholders(frMessage));
    }
  });
});
