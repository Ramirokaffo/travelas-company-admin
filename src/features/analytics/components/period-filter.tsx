"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ANALYTICS_PERIODS,
  DEFAULT_PERIOD,
  PERIOD_PARAM,
  type AnalyticsPeriod,
} from "@/features/analytics/period";
import { cn } from "@/lib/utils/cn";

/**
 * Sélecteur de période.
 *
 * Des **liens**, pas des boutons : la période fait partie de l'adresse, donc
 * de ce qu'on partage à un associé ou qu'on retrouve dans l'historique. Chaque
 * choix relance un rendu serveur, donc une lecture fraîche du backend — ce qui
 * est le comportement attendu de données d'exploitation.
 *
 * Les autres paramètres de l'URL sont préservés : passer de « ce mois-ci » à
 * « cette année » ne doit pas effacer le filtre d'agence en cours.
 */
export function PeriodFilter({ period }: { period: AnalyticsPeriod }) {
  const t = useTranslations("analytics.periods");
  const tCommon = useTranslations("analytics");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (value: AnalyticsPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_PERIOD) {
      params.delete(PERIOD_PARAM);
    } else {
      params.set(PERIOD_PARAM, value);
    }
    // Changer de période rebat les cartes : rester en page 5 d'une liste
    // filtrée sur « aujourd'hui » afficherait un écran vide.
    params.delete("page");

    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  return (
    <div
      role="group"
      aria-label={tCommon("periodLabel")}
      className="border-subtle bg-surface inline-flex flex-wrap gap-1 rounded-xl border p-1"
    >
      {ANALYTICS_PERIODS.map((value) => {
        const isActive = value === period;

        return (
          <Link
            key={value}
            href={hrefFor(value)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                : "text-muted hover:bg-subtle hover:text-foreground",
            )}
          >
            {t(value)}
          </Link>
        );
      })}
    </div>
  );
}
