import { z } from "zod";

/**
 * Schémas du domaine « avis clients » (`OpinionEntity`).
 *
 * La note est un `float` en base : `4.5` est une valeur légitime, `toFixed(0)`
 * l'écraserait. Elle est bornée à 0–5 côté DTO.
 */

const numeric = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });

export const opinionEntitySchema = z
  .object({
    id: z.string(),
    comment: z.string().nullable().optional(),
    rating: numeric,
    createAt: z.union([z.string(), z.date()]).nullable().optional(),
    user: z
      .object({
        id: z.string().optional(),
        firstName: z.string().nullable().optional(),
        lastName: z.string().nullable().optional(),
        profilImage: z.string().nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
  })
  .loose();

export type OpinionEntity = z.infer<typeof opinionEntitySchema>;

/**
 * Vue projetée transmise au navigateur.
 *
 * L'auteur est réduit à un prénom et une initiale : afficher le nom complet
 * d'un voyageur dans un back-office n'apporte rien à l'exploitation et
 * multiplie les données nominatives en circulation.
 */
export type Opinion = {
  id: string;
  comment: string | null;
  rating: number;
  createdAt: string | null;
  author: string | null;
};

export function toOpinion(entity: OpinionEntity): Opinion {
  const createdAt = entity.createAt;
  const firstName = entity.user?.firstName?.trim();
  const lastInitial = entity.user?.lastName?.trim().charAt(0);

  return {
    id: entity.id,
    comment: entity.comment?.trim() || null,
    rating: Math.min(Math.max(entity.rating, 0), 5),
    createdAt:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : typeof createdAt === "string"
          ? createdAt
          : null,
    author: firstName ? `${firstName}${lastInitial ? ` ${lastInitial}.` : ""}` : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Filtres de liste                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Tranches de note.
 *
 * `FilterOpinionDto` expose `minRating` et `maxRating`, pas une valeur exacte :
 * les tranches en découlent directement.
 */
export const OPINION_RATINGS = ["all", "positive", "neutral", "negative"] as const;
export type OpinionRating = (typeof OPINION_RATINGS)[number];

export const RATING_RANGE: Record<
  Exclude<OpinionRating, "all">,
  { min: number; max: number }
> = {
  positive: { min: 4, max: 5 },
  neutral: { min: 3, max: 4 },
  negative: { min: 0, max: 2 },
};

export type OpinionFilters = { rating: OpinionRating };

export const OPINION_FILTER_PARAM = { rating: "note" } as const;

export function parseOpinionFilters(
  params: Record<string, string | string[] | undefined>,
): OpinionFilters {
  const raw = params[OPINION_FILTER_PARAM.rating];
  const value = Array.isArray(raw) ? raw[0] : raw;

  return {
    rating: OPINION_RATINGS.includes(value as OpinionRating)
      ? (value as OpinionRating)
      : "all",
  };
}
