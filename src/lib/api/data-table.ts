import { z } from "zod";

/**
 * Pagination, tri et recherche unifiés pour toutes les listes du dashboard.
 *
 * Ce module isole trois pièges du backend NestJS :
 *
 * 1. **`page` est 0-indexé côté API**, alors qu'une interface se compte à partir
 *    de 1. La conversion se fait à un seul endroit : `toBackendQuery()`.
 * 2. **La forme des réponses paginées n'est pas homogène.** Selon l'endpoint on
 *    reçoit un tableau nu (`GET /seat/getMyCompanySeat`), un tuple
 *    `[items, total]` (`findAndCount` de TypeORM) ou un objet `{ users, total }`
 *    (`GET /user/getMyCompanyUsers`). `paginatedSchema()` valide les trois et
 *    les normalise en `{ items, total }`.
 * 3. **Le total est souvent absent** (les endpoints `getMyCompany*` ignorent
 *    `withCount`). `toPageMeta()` dégrade alors proprement au lieu d'afficher un
 *    nombre de pages faux.
 *
 * Module volontairement pur (ni `server-only`, ni accès à `env`) : les Server
 * Components le lisent pour construire leurs requêtes, les composants clients de
 * pagination pour construire leurs liens.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Borne haute défensive : une taille de page arbitraire est un vecteur de DoS. */
const MAX_PAGE_SIZE = 100;
/** Borne haute sur le numéro de page, pour éviter un `skip` absurde en base. */
const MAX_PAGE = 10_000;
const MAX_SEARCH_LENGTH = 100;

/** Noms des paramètres d'URL. Centralisés pour rester cohérents d'une page à l'autre. */
export const TABLE_PARAM = {
  page: "page",
  perPage: "perPage",
  search: "q",
  sort: "sort",
  order: "order",
} as const;

export type SortOrder = "asc" | "desc";

export type TableQuery = {
  /** Page affichée, **1-indexée**. La conversion vers l'API se fait dans `toBackendQuery()`. */
  page: number;
  perPage: number;
  search: string | null;
  /** Colonne de tri, validée contre une liste blanche. `null` = tri par défaut du backend. */
  sortBy: string | null;
  sortOrder: SortOrder;
};

/** Forme des `searchParams` d'une page App Router. */
export type SearchParamsInput = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toBoundedInt(
  raw: string | undefined,
  { fallback, min, max }: { fallback: number; min: number; max: number },
): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export type ParseTableQueryOptions = {
  defaultPerPage?: number;
  /**
   * Colonnes de tri autorisées. **Obligatoire pour activer le tri** : la valeur
   * finit en `orderBy` dans une requête SQL côté backend, on ne relaie donc
   * jamais une chaîne libre venue de l'URL.
   */
  sortableColumns?: readonly string[];
  defaultSortBy?: string;
  defaultSortOrder?: SortOrder;
};

/** Lit et assainit les paramètres de liste d'une URL. Toujours une valeur exploitable. */
export function parseTableQuery(
  params: SearchParamsInput,
  options: ParseTableQueryOptions = {},
): TableQuery {
  const {
    defaultPerPage = DEFAULT_PAGE_SIZE,
    sortableColumns = [],
    defaultSortBy,
    defaultSortOrder = "desc",
  } = options;

  const rawSearch = firstValue(params[TABLE_PARAM.search])?.trim() ?? "";
  const rawSort = firstValue(params[TABLE_PARAM.sort]);
  const rawOrder = firstValue(params[TABLE_PARAM.order])?.toLowerCase();

  const sortBy =
    rawSort && sortableColumns.includes(rawSort) ? rawSort : (defaultSortBy ?? null);

  return {
    page: toBoundedInt(firstValue(params[TABLE_PARAM.page]), {
      fallback: 1,
      min: 1,
      max: MAX_PAGE,
    }),
    perPage: toBoundedInt(firstValue(params[TABLE_PARAM.perPage]), {
      fallback: defaultPerPage,
      min: 1,
      max: MAX_PAGE_SIZE,
    }),
    search: rawSearch ? rawSearch.slice(0, MAX_SEARCH_LENGTH) : null,
    sortBy,
    sortOrder: rawOrder === "asc" || rawOrder === "desc" ? rawOrder : defaultSortOrder,
  };
}

/**
 * Traduit une `TableQuery` en paramètres d'URL du backend.
 *
 * ⚠️ **Seul endroit du dépôt où se fait la conversion 1-indexé → 0-indexé.**
 * Le backend calcule `skip = page * count` : envoyer la page d'interface telle
 * quelle sauterait silencieusement la première page.
 */
export function toBackendQuery(
  query: TableQuery,
  options: { withCount?: boolean } = {},
): Record<string, string | number | boolean | undefined> {
  const { withCount = true } = options;

  return {
    page: query.page - 1,
    count: query.perPage,
    withCount,
    ...(query.search ? { search: query.search } : {}),
    ...(query.sortBy
      ? // `OrderValueEnum` côté backend attend ASC/DESC en majuscules.
        { orderBy: query.sortBy, order: query.sortOrder.toUpperCase() }
      : {}),
  };
}

export type Paginated<T> = {
  items: T[];
  /** `null` quand l'endpoint ne renvoie pas de total (cas fréquent, cf. en-tête). */
  total: number | null;
};

/**
 * Schéma d'une réponse de liste, tolérant aux trois formes renvoyées par l'API.
 *
 * @param itemSchema schéma d'un élément
 * @param options.key clé du tableau pour les réponses en objet (`users`, `tickets`…)
 *
 * @example
 * const schema = paginatedSchema(userSchema, { key: "users" });
 * const { items, total } = await apiFetch("/user/getMyCompanyUsers", schema, { accessToken });
 */
export function paginatedSchema<TItem extends z.ZodType>(
  itemSchema: TItem,
  options: { key?: string } = {},
): z.ZodType<Paginated<z.infer<TItem>>, unknown> {
  const list = z.array(itemSchema);

  // `findAndCount` de TypeORM : [items, total].
  const asTuple = z
    .tuple([list, z.number()])
    .transform(([items, total]) => ({ items, total }));

  // Tableau nu : aucun total disponible.
  const asArray = list.transform((items) => ({ items, total: null }));

  const variants = options.key
    ? ([
        asTuple,
        z
          .object({ [options.key]: list, total: z.number().optional() })
          .loose()
          .transform((payload) => ({
            items: payload[options.key as string] as z.infer<TItem>[],
            total: payload.total ?? null,
          })),
        asArray,
      ] as const)
    : ([asTuple, asArray] as const);

  return z.union(variants) as z.ZodType<Paginated<z.infer<TItem>>, unknown>;
}

export type PageMeta = {
  page: number;
  perPage: number;
  total: number | null;
  /** `null` tant que le backend ne renvoie pas de total. */
  pageCount: number | null;
  /** Index 1-indexé du premier élément affiché (0 si la page est vide). */
  from: number;
  to: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

/**
 * Construit les métadonnées d'affichage d'une page de résultats.
 *
 * Sans total, `hasNext` est **déduit** du remplissage de la page : une page
 * pleine laisse supposer une suite. L'heuristique affiche au pire un « suivant »
 * menant à une page vide — préférable à un nombre de pages inventé.
 */
export function toPageMeta(
  query: TableQuery,
  result: { items: readonly unknown[]; total: number | null },
): PageMeta {
  const { page, perPage } = query;
  const { total } = result;
  const itemCount = result.items.length;

  const pageCount = total === null ? null : Math.max(1, Math.ceil(total / perPage));
  const from = itemCount === 0 ? 0 : (page - 1) * perPage + 1;

  return {
    page,
    perPage,
    total,
    pageCount,
    from,
    to: itemCount === 0 ? 0 : (page - 1) * perPage + itemCount,
    hasPrevious: page > 1,
    hasNext: pageCount === null ? itemCount === perPage : page < pageCount,
  };
}

/**
 * Construit l'URL d'une liste après modification d'un critère.
 *
 * Les valeurs par défaut sont omises pour garder des URLs lisibles et
 * partageables. Tout changement de critère ramène à la page 1, sauf demande
 * explicite : rester en page 7 après une recherche affiche un écran vide.
 */
export function buildTableHref(
  pathname: string,
  current: TableQuery,
  patch: Partial<TableQuery>,
  options: { defaultPerPage?: number } = {},
): string {
  const { defaultPerPage = DEFAULT_PAGE_SIZE } = options;
  const next: TableQuery = {
    ...current,
    // Un changement autre que la page elle-même réinitialise la pagination.
    ...(patch.page === undefined ? { page: 1 } : {}),
    ...patch,
  };

  const params = new URLSearchParams();
  if (next.page > 1) params.set(TABLE_PARAM.page, String(next.page));
  if (next.perPage !== defaultPerPage) {
    params.set(TABLE_PARAM.perPage, String(next.perPage));
  }
  if (next.search) params.set(TABLE_PARAM.search, next.search);
  if (next.sortBy) {
    params.set(TABLE_PARAM.sort, next.sortBy);
    params.set(TABLE_PARAM.order, next.sortOrder);
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
