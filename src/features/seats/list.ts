import type { TableQuery } from "@/lib/api/data-table";

import type { SeatFilters, SeatSummary } from "./schemas";

/**
 * Recherche, tri et pagination des agences — **en mémoire**.
 *
 * Ce n'est pas un choix de confort. `GET /seat/getMyCompanySeat` n'accepte que
 * `page` et `count` (deux `ParseIntPipe`, sans DTO) : ni recherche, ni tri, ni
 * `withCount`. Paginer côté serveur donnerait donc une liste sans total, sans
 * recherche et dans l'ordre d'insertion en base.
 *
 * Le volume rend l'arbitrage évident : une entreprise de transport exploite des
 * dizaines d'agences, pas des dizaines de milliers. On charge la fenêtre
 * complète une fois (cf. `SEAT_WINDOW` dans `api.ts`, qui signale une éventuelle
 * troncature) et tout le reste se fait ici. À revoir le jour où le backend
 * exposera un `SeatFilterDto` cadré entreprise.
 *
 * Module volontairement pur : testable sans réseau, et la locale est passée en
 * argument plutôt que lue depuis le contexte de requête.
 */

/** Minuscules sans accents : « Abidjan Gare Nord » se trouve avec « gare nord ». */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function haystack(seat: SeatSummary): string {
  return normalize(
    [seat.name, seat.street, seat.agency?.name, seat.agency?.city]
      .filter(Boolean)
      .join(" "),
  );
}

export function filterSeats(
  seats: readonly SeatSummary[],
  query: Pick<TableQuery, "search">,
  filters: SeatFilters,
): SeatSummary[] {
  const needle = query.search ? normalize(query.search) : null;

  return seats.filter((seat) => {
    if (filters.status === "active" && !seat.isActive) return false;
    if (filters.status === "inactive" && seat.isActive) return false;
    return needle === null || haystack(seat).includes(needle);
  });
}

/**
 * Agence principale d'abord, puis ordre alphabétique.
 *
 * Le tri dépend de la langue : l'ordre des caractères accentués et la casse ne
 * se comparent pas de la même façon d'une locale à l'autre.
 */
export function sortSeats(
  seats: readonly SeatSummary[],
  locale: string,
): SeatSummary[] {
  const collator = new Intl.Collator(locale);

  return [...seats].sort((a, b) => {
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
    // Une agence sans nom passe en fin de liste plutôt qu'en tête.
    if (a.name === null) return b.name === null ? 0 : 1;
    if (b.name === null) return -1;
    return collator.compare(a.name, b.name);
  });
}

/**
 * Page affichable et total réel.
 *
 * `total` est ici exact — contrairement aux listes paginées côté backend, où il
 * est souvent `null`. `toPageMeta()` peut donc afficher un vrai nombre de pages.
 */
export function selectSeatPage(
  seats: readonly SeatSummary[],
  query: TableQuery,
  filters: SeatFilters,
  locale: string,
): { items: SeatSummary[]; total: number } {
  const matching = sortSeats(filterSeats(seats, query, filters), locale);
  const start = (query.page - 1) * query.perPage;

  return {
    items: matching.slice(start, start + query.perPage),
    total: matching.length,
  };
}
