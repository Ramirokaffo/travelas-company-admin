/**
 * Filtres communs aux pages de recettes.
 *
 * Module pur : lu par les Server Components pour construire leurs requêtes et
 * par la barre de filtres cliente pour construire ses liens.
 */

export const REVENUE_FILTER_PARAM = { seat: "agence" } as const;

export type RevenueFilters = {
  /** `null` = toutes les agences de l'entreprise. */
  seatId: string | null;
};

export function parseRevenueFilters(
  params: Record<string, string | string[] | undefined>,
): RevenueFilters {
  const raw = params[REVENUE_FILTER_PARAM.seat];
  const value = Array.isArray(raw) ? raw[0] : raw;

  // Aucune validation d'appartenance ici : le backend refuse (ou ne renvoie
  // rien pour) une agence d'une autre entreprise, puisque le filtre est croisé
  // avec le cadrage entreprise. Un identifiant inventé donne une liste vide,
  // jamais les données d'un concurrent.
  return { seatId: value && value.trim() ? value.trim() : null };
}
