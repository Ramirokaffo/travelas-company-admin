import "server-only";

import { z } from "zod";

import { getLocale } from "next-intl/server";

import { paginatedSchema } from "@/lib/api/data-table";
import { apiFetch } from "@/lib/api/server-api";

import {
  fromBookingMode,
  seatEntitySchema,
  toSeatOption,
  toSeatSummary,
  type SeatFormValues,
  type SeatOption,
  type SeatSummary,
} from "./schemas";

/**
 * Accès backend du domaine « agences » (`SeatEntity`) — SERVEUR UNIQUEMENT.
 *
 * `GET /seat/getMyCompanySeat` est le seul point d'entrée cadré entreprise. Il
 * exige `page` et `count` (`ParseIntPipe` sans valeur par défaut : les omettre
 * renvoie une 400), ignore `withCount` et **ne renvoie aucun total**. La
 * recherche, le tri et la pagination sont donc traités en mémoire — voir
 * `list.ts` pour l'arbitrage.
 */

const seatListSchema = paginatedSchema(seatEntitySchema);

/**
 * Nombre maximal d'agences chargées en une fois.
 *
 * Au-delà, la liste est tronquée et l'interface le signale : mieux vaut un
 * avertissement visible qu'une liste silencieusement incomplète.
 */
export const SEAT_WINDOW = 200;

/**
 * Fenêtre d'agences de l'entreprise.
 *
 * On demande volontairement un élément de plus que le plafond : c'est le seul
 * moyen de détecter une troncature sur un endpoint qui ne renvoie pas de total.
 */
async function fetchCompanySeats(
  accessToken: string,
  limit: number,
): Promise<{ entities: z.infer<typeof seatEntitySchema>[]; truncated: boolean }> {
  const result = await apiFetch("/seat/getMyCompanySeat", seatListSchema, {
    accessToken,
    query: { page: 0, count: limit + 1 },
  });

  return {
    entities: result.items.slice(0, limit),
    truncated: result.items.length > limit,
  };
}

/** Liste complète des agences, pour la page `/seats`. */
export async function listCompanySeats(
  accessToken: string,
): Promise<{ seats: SeatSummary[]; truncated: boolean }> {
  const { entities, truncated } = await fetchCompanySeats(accessToken, SEAT_WINDOW);

  return { seats: entities.map(toSeatSummary), truncated };
}

/**
 * Agences de l'entreprise réduites à un sélecteur d'affectation (`/staff`).
 *
 * Triées ici plutôt que dans `list.ts` : un menu déroulant n'a ni filtre ni
 * pagination, seulement un ordre d'affichage.
 */
export async function listCompanySeatOptions(
  accessToken: string,
  { limit = SEAT_WINDOW }: { limit?: number } = {},
): Promise<SeatOption[]> {
  const { entities } = await fetchCompanySeats(accessToken, limit);

  // Le tri alphabétique dépend de la langue : l'ordre des caractères accentués
  // et la casse ne se comparent pas de la même façon d'une locale à l'autre.
  const collator = new Intl.Collator(await getLocale());

  return entities.map(toSeatOption).sort((a, b) => {
    // L'agence principale d'abord, le reste par ordre alphabétique.
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
    // Une agence sans nom passe en fin de liste plutôt qu'en tête.
    if (a.name === null) return b.name === null ? 0 : 1;
    if (b.name === null) return -1;
    return collator.compare(a.name, b.name);
  });
}

/**
 * Corps accepté par `POST /seat` et `PATCH /seat/:id`.
 *
 * `companyId` n'est **jamais** transmis : le service l'ignore pour un
 * `company_admin` et le remplace par `user.company` (`requireCompanyId`).
 * `agencyId` est converti en entier — le DTO le valide avec `@IsInt()`, une
 * chaîne produirait une 400.
 *
 * `allowSeatNumberBook` peut valoir `null` : `@IsOptional()` de class-validator
 * laisse passer `null` comme `undefined`, ce qui permet de **revenir** au
 * réglage de l'entreprise après l'avoir surchargé. Omettre le champ ne le
 * ferait pas — il conserverait sa valeur.
 */
function toBackendPayload(values: SeatFormValues) {
  return {
    name: values.name,
    agencyId: Number(values.agencyId),
    isMain: values.isMain,
    isActive: values.isActive,
    hasBedroom: values.hasBedroom,
    allowSeatNumberBook: fromBookingMode(values.allowSeatNumberBook),
    ...(values.street ? { street: values.street } : {}),
    ...(values.lat ? { lat: Number(values.lat) } : {}),
    ...(values.long ? { long: Number(values.long) } : {}),
  };
}

export async function createSeat(
  values: SeatFormValues,
  accessToken: string,
): Promise<SeatSummary> {
  const seat = await apiFetch("/seat", seatEntitySchema, {
    method: "POST",
    accessToken,
    body: toBackendPayload(values),
  });

  return toSeatSummary(seat);
}

export async function updateSeat(
  id: string,
  values: SeatFormValues,
  accessToken: string,
): Promise<SeatSummary> {
  const seat = await apiFetch(`/seat/${encodeURIComponent(id)}`, seatEntitySchema, {
    method: "PATCH",
    accessToken,
    body: toBackendPayload(values),
  });

  return toSeatSummary(seat);
}

/**
 * Active ou désactive une agence.
 *
 * Opération réversible, à distinguer de `deleteSeat()` : une agence désactivée
 * reste listée et peut être remise en service.
 */
export async function setSeatActive(
  id: string,
  isActive: boolean,
  accessToken: string,
): Promise<void> {
  await apiFetch(`/seat/${encodeURIComponent(id)}`, seatEntitySchema, {
    method: "PATCH",
    accessToken,
    body: { isActive },
  });
}

/**
 * Suppression logique (`softDelete` côté backend).
 *
 * Irréversible depuis le dashboard : aucun endpoint de restauration n'existe.
 * La réponse est un `UpdateResult` TypeORM, sans forme stable — on ne valide
 * donc que le succès HTTP.
 */
export async function deleteSeat(id: string, accessToken: string): Promise<void> {
  await apiFetch(`/seat/${encodeURIComponent(id)}`, z.unknown(), {
    method: "DELETE",
    accessToken,
  });
}

/**
 * Fiche d'une agence.
 *
 * `GET /seat/:seatId` passe par `assertSeatBelongsToUser()` côté backend : un
 * identifiant appartenant à une autre entreprise est refusé en 403, et un
 * identifiant inconnu en 404. C'est cette garantie — et non un filtrage côté
 * dashboard — qui rend la page `/seats/[id]` sûre malgré un paramètre d'URL
 * librement modifiable.
 */
export async function getSeatDetail(
  id: string,
  accessToken: string,
): Promise<SeatSummary> {
  const seat = await apiFetch(`/seat/${encodeURIComponent(id)}`, seatEntitySchema, {
    accessToken,
  });

  return toSeatSummary(seat);
}
