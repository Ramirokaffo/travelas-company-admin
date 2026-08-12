import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type StatCardProps = {
  label: string;
  /** Déjà formatée par l'appelant : lui seul sait s'il s'agit d'argent, d'un nombre ou d'un taux. */
  value: ReactNode;
  icon?: LucideIcon;
  /** Variation en pourcentage sur la période précédente. `null` = pas de comparaison possible. */
  change?: number | null;
  trend?: "up" | "down" | "stable";
  /**
   * `true` quand une hausse est une mauvaise nouvelle (incidents, impayés).
   * Sans cela, un bond de 40 % des incidents s'afficherait en vert.
   */
  invertTrend?: boolean;
  hint?: string;
  className?: string;
};

/**
 * Tuile de statistique.
 *
 * Forme retenue plutôt qu'un graphique à une barre : une valeur unique
 * accompagnée de sa variation se lit d'un coup d'œil, là où un graphique
 * demanderait un axe pour dire la même chose.
 *
 * La flèche ne porte jamais seule le sens : elle est doublée du pourcentage
 * signé, et sa couleur n'est qu'un renfort — une hausse reste lisible en
 * niveaux de gris comme sous daltonisme.
 */
export async function StatCard({
  label,
  value,
  icon: Icon,
  change = null,
  trend = "stable",
  invertTrend = false,
  hint,
  className,
}: StatCardProps) {
  const t = await getTranslations("analytics");

  const isGood = invertTrend ? trend === "down" : trend === "up";
  const isBad = invertTrend ? trend === "up" : trend === "down";
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "border-subtle bg-surface flex flex-col gap-3 rounded-2xl border p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted text-sm font-medium">{label}</p>
        {Icon ? (
          <span className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 rounded-lg p-2">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>

      <p className="text-2xl font-semibold tabular-nums">{value}</p>

      {change === null ? (
        hint ? (
          <p className="text-muted text-xs">{hint}</p>
        ) : null
      ) : (
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium tabular-nums",
              isGood && "text-success",
              isBad && "text-danger",
              !isGood && !isBad && "text-muted",
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden />
            {t("changeValue", {
              value: Math.abs(change),
              sign: change >= 0 ? "+" : "−",
            })}
          </span>
          <span className="text-muted">{hint ?? t("versusPrevious")}</span>
        </p>
      )}
    </div>
  );
}
