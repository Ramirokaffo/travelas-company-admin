import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  DEFAULT_PAGE_SIZE,
  buildTableHref,
  paginatedSchema,
  parseTableQuery,
  toBackendQuery,
  toPageMeta,
  type TableQuery,
} from "./data-table";

const SORTABLE = ["createAt", "name"] as const;

describe("parseTableQuery", () => {
  it("fournit des valeurs par défaut sûres pour une URL nue", () => {
    expect(parseTableQuery({})).toEqual({
      page: 1,
      perPage: DEFAULT_PAGE_SIZE,
      search: null,
      sortBy: null,
      sortOrder: "desc",
    });
  });

  it("lit les paramètres fournis", () => {
    expect(
      parseTableQuery(
        { page: "3", perPage: "50", q: "  plateau  ", sort: "name", order: "asc" },
        { sortableColumns: SORTABLE },
      ),
    ).toEqual({
      page: 3,
      perPage: 50,
      search: "plateau",
      sortBy: "name",
      sortOrder: "asc",
    });
  });

  it("borne les valeurs hors limites", () => {
    expect(parseTableQuery({ page: "0" }).page).toBe(1);
    expect(parseTableQuery({ page: "-5" }).page).toBe(1);
    expect(parseTableQuery({ perPage: "100000" }).perPage).toBe(100);
    expect(parseTableQuery({ perPage: "0" }).perPage).toBe(1);
  });

  it("ignore les valeurs non numériques", () => {
    expect(parseTableQuery({ page: "abc", perPage: "1.5" })).toMatchObject({
      page: 1,
      perPage: DEFAULT_PAGE_SIZE,
    });
  });

  // Le tri finit en `orderBy` dans une requête SQL côté backend : une colonne
  // arbitraire venue de l'URL ne doit jamais y arriver.
  it("rejette une colonne de tri hors liste blanche", () => {
    expect(
      parseTableQuery(
        { sort: "password" },
        { sortableColumns: SORTABLE, defaultSortBy: "createAt" },
      ).sortBy,
    ).toBe("createAt");

    expect(parseTableQuery({ sort: "name" }).sortBy).toBeNull();
  });

  it("rejette un sens de tri inconnu", () => {
    expect(parseTableQuery({ order: "; DROP TABLE user" }).sortOrder).toBe("desc");
    expect(parseTableQuery({ order: "ASC" }).sortOrder).toBe("asc");
  });

  it("tronque une recherche démesurée", () => {
    expect(parseTableQuery({ q: "a".repeat(500) }).search).toHaveLength(100);
  });

  it("ne retient que la première occurrence d'un paramètre répété", () => {
    expect(parseTableQuery({ page: ["4", "9"] }).page).toBe(4);
  });
});

describe("toBackendQuery", () => {
  // Régression la plus coûteuse du projet : le backend calcule
  // `skip = page * count`. Envoyer la page d'interface telle quelle sauterait
  // silencieusement la première page de chaque liste.
  it("convertit la page 1-indexée en page 0-indexée", () => {
    expect(toBackendQuery(parseTableQuery({}))).toMatchObject({ page: 0 });
    expect(toBackendQuery(parseTableQuery({ page: "4" }))).toMatchObject({ page: 3 });
  });

  it("traduit perPage en count et demande le total", () => {
    expect(toBackendQuery(parseTableQuery({ perPage: "50" }))).toMatchObject({
      count: 50,
      withCount: true,
    });
  });

  it("omet la recherche et le tri quand ils sont vides", () => {
    const query = toBackendQuery(parseTableQuery({}));
    expect(query).not.toHaveProperty("search");
    expect(query).not.toHaveProperty("orderBy");
  });

  it("transmet le tri au format attendu par OrderValueEnum", () => {
    expect(
      toBackendQuery(
        parseTableQuery({ sort: "name", order: "asc" }, { sortableColumns: SORTABLE }),
      ),
    ).toMatchObject({ orderBy: "name", order: "ASC" });
  });

  it("permet de désactiver le comptage", () => {
    expect(toBackendQuery(parseTableQuery({}), { withCount: false })).toMatchObject({
      withCount: false,
    });
  });
});

describe("paginatedSchema", () => {
  const itemSchema = z.object({ id: z.string() });

  it("normalise un tableau nu (endpoints getMyCompany*)", () => {
    const schema = paginatedSchema(itemSchema);
    expect(schema.parse([{ id: "a" }, { id: "b" }])).toEqual({
      items: [{ id: "a" }, { id: "b" }],
      total: null,
    });
  });

  it("normalise un tuple [items, total] (findAndCount de TypeORM)", () => {
    const schema = paginatedSchema(itemSchema);
    expect(schema.parse([[{ id: "a" }], 42])).toEqual({
      items: [{ id: "a" }],
      total: 42,
    });
  });

  it("normalise un objet { <clé>, total } (getMyCompanyUsers)", () => {
    const schema = paginatedSchema(itemSchema, { key: "users" });
    expect(schema.parse({ users: [{ id: "a" }], total: 3 })).toEqual({
      items: [{ id: "a" }],
      total: 3,
    });
  });

  it("accepte un objet sans total", () => {
    const schema = paginatedSchema(itemSchema, { key: "users" });
    expect(schema.parse({ users: [] })).toEqual({ items: [], total: null });
  });

  it("distingue le tuple vide du tableau vide", () => {
    const schema = paginatedSchema(itemSchema);
    expect(schema.parse([[], 0])).toEqual({ items: [], total: 0 });
    expect(schema.parse([])).toEqual({ items: [], total: null });
  });

  it("échoue sur un élément non conforme plutôt que de le laisser passer", () => {
    const schema = paginatedSchema(itemSchema);
    expect(schema.safeParse([{ identifiant: "a" }]).success).toBe(false);
    expect(schema.safeParse({ oups: true }).success).toBe(false);
  });
});

describe("toPageMeta", () => {
  const query = (patch: Partial<TableQuery> = {}): TableQuery => ({
    page: 1,
    perPage: 20,
    search: null,
    sortBy: null,
    sortOrder: "desc",
    ...patch,
  });

  it("calcule la plage affichée et le nombre de pages", () => {
    expect(
      toPageMeta(query({ page: 2 }), { items: new Array(20).fill(null), total: 87 }),
    ).toMatchObject({
      from: 21,
      to: 40,
      pageCount: 5,
      hasPrevious: true,
      hasNext: true,
    });
  });

  it("gère la dernière page partielle", () => {
    expect(
      toPageMeta(query({ page: 5 }), { items: new Array(7).fill(null), total: 87 }),
    ).toMatchObject({ from: 81, to: 87, hasNext: false });
  });

  it("gère une page vide", () => {
    expect(toPageMeta(query(), { items: [], total: 0 })).toMatchObject({
      from: 0,
      to: 0,
      pageCount: 1,
      hasNext: false,
      hasPrevious: false,
    });
  });

  // Sans total, on ne peut pas afficher « page 2 / 5 » — mais une page pleine
  // laisse supposer une suite.
  it("déduit l'existence d'une page suivante quand le total manque", () => {
    expect(
      toPageMeta(query(), { items: new Array(20).fill(null), total: null }),
    ).toMatchObject({ pageCount: null, hasNext: true });

    expect(
      toPageMeta(query(), { items: new Array(12).fill(null), total: null }),
    ).toMatchObject({ pageCount: null, hasNext: false });
  });
});

describe("buildTableHref", () => {
  const current = parseTableQuery({ page: "3", q: "plateau" });

  it("omet les valeurs par défaut", () => {
    expect(buildTableHref("/seats", parseTableQuery({}), {})).toBe("/seats");
  });

  it("conserve les critères en changeant de page", () => {
    expect(buildTableHref("/seats", current, { page: 4 })).toBe(
      "/seats?page=4&q=plateau",
    );
  });

  // Rester en page 3 après une recherche affiche un écran vide.
  it("revient en page 1 dès qu'un autre critère change", () => {
    expect(buildTableHref("/seats", current, { search: "yopougon" })).toBe(
      "/seats?q=yopougon",
    );
    expect(buildTableHref("/seats", current, { perPage: 50 })).toBe(
      "/seats?perPage=50&q=plateau",
    );
  });

  it("sérialise le tri", () => {
    expect(
      buildTableHref("/staff", parseTableQuery({}), {
        sortBy: "name",
        sortOrder: "asc",
      }),
    ).toBe("/staff?sort=name&order=asc");
  });
});
