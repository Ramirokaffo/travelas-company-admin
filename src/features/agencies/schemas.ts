import { z } from "zod";

/**
 * Domaine « gares » (`AgencyEntity`).
 *
 * ⚠️ **Faux ami central du projet.** Côté backend, `agency` ne désigne PAS une
 * agence d'entreprise — c'est `seat` — mais un **point géographique** : une gare
 * rattachée à une ville, partagée par toutes les entreprises de transport. Une
 * agence (`seat`) se rattache à une gare, et cette gare est obligatoire à la
 * création (`CreateSeatDto.agencyId`, `@IsNotEmpty()`).
 *
 * Module volontairement pur : le sélecteur de gare est un composant client.
 */

export const agencyRefSchema = z
  .object({
    // `AgencyEntity.id` est un entier auto-incrémenté, pas un UUID comme `seat`.
    id: z.number(),
    name: z.string().nullable().optional(),
    city: z
      .object({ id: z.number(), name: z.string().nullable().optional() })
      .loose()
      .nullable()
      .optional(),
  })
  .loose();

export type AgencyRef = z.infer<typeof agencyRefSchema>;

/** Vue minimale d'une gare, suffisante pour un sélecteur. */
export type AgencyOption = {
  id: number;
  /** `null` si la gare n'a pas de nom : le libellé de repli dépend de la langue. */
  name: string | null;
  city: string | null;
};

export function toAgencyOption(entity: AgencyRef): AgencyOption {
  return {
    id: entity.id,
    name: entity.name ?? null,
    city: entity.city?.name ?? null,
  };
}
