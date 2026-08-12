import { getTranslations } from "next-intl/server";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Écran d'attente par défaut des pages protégées.
 *
 * Chaque page peut fournir son propre `loading.tsx` plus fidèle à sa mise en
 * page ; celui-ci sert de repli pour les segments qui n'en ont pas.
 */
export default async function DashboardLoading() {
  const t = await getTranslations("common");

  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label={t("loading")}>
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
