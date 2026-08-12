import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

/**
 * Bloc de chargement.
 *
 * `aria-hidden` : un lecteur d'écran n'a rien à annoncer d'une forme grise. Le
 * conteneur qui l'affiche porte l'information (`aria-busy`, `role="status"`).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-subtle animate-pulse rounded-md", className)} aria-hidden />
  );
}

/** Squelette de tableau, calé sur la géométrie de `components/ui/table`. */
export function TableSkeleton({
  rows = 6,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  const t = useTranslations("skeleton");

  return (
    <div role="status" aria-busy="true" aria-label={t("loadingData")}>
      <div className="border-subtle flex gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-subtle divide-y">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }, (_, columnIndex) => (
              <Skeleton key={columnIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Squelette de rangée de KPI (vue d'ensemble, statistiques). */
export function StatsSkeleton({ cards = 4 }: { cards?: number }) {
  const t = useTranslations("skeleton");

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t("loadingStats")}
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          className="border-subtle bg-surface space-y-3 rounded-2xl border p-5"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
