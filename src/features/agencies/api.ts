import "server-only";

import { getLocale } from "next-intl/server";

import { paginatedSchema } from "@/lib/api/data-table";
import { apiFetch } from "@/lib/api/server-api";

import { agencyRefSchema, toAgencyOption, type AgencyOption } from "./schemas";

/**
 * Accès backend du domaine « gares » — SERVEUR UNIQUEMENT.
 *
 * `GET /agency` ne porte aucun `@Roles()` : la route est ouverte à tout compte
 * authentifié, ce qui est cohérent — le référentiel géographique n'appartient à
 * aucune entreprise et ne contient rien de confidentiel.
 */

const agencyListSchema = paginatedSchema(agencyRefSchema);

/**
 * Plafond du référentiel chargé pour alimenter un sélecteur.
 *
 * `FilterAgencyDto` accepte `search`, mais un `<select>` natif ne sait pas
 * interroger le serveur pendant la frappe : on charge donc le référentiel
 * complet, qui se compte en dizaines de gares. Au-delà de ce plafond il faudra
 * un champ de recherche asynchrone plutôt qu'une liste déroulante.
 */
const AGENCY_LIMIT = 300;

/** Toutes les gares, groupables par ville, triées pour l'affichage. */
export async function listAgencyOptions(accessToken: string): Promise<AgencyOption[]> {
  const result = await apiFetch("/agency", agencyListSchema, {
    accessToken,
    // `page` et `count` sont facultatifs dans le DTO, mais le service calcule
    // `skip: page * count` sans valeur de repli : les omettre produit un
    // `skip: NaN`.
    query: { page: 0, count: AGENCY_LIMIT },
  });

  // L'ordre des caractères accentués dépend de la langue : « Abidjan », « Éloka »
  // et « Zuénoula » ne se comparent pas de la même façon d'une locale à l'autre.
  const collator = new Intl.Collator(await getLocale());

  return result.items.map(toAgencyOption).sort((a, b) => {
    // Groupées par ville, puis par nom de gare. Une valeur absente passe en fin
    // de liste plutôt qu'en tête.
    const byCity = collator.compare(a.city ?? "￿", b.city ?? "￿");
    if (byCity !== 0) return byCity;
    return collator.compare(a.name ?? "￿", b.name ?? "￿");
  });
}
