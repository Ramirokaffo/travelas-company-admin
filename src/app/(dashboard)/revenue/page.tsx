import { Download, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { listCompanyRecipes } from "@/features/analytics/api";
import { RecipeTable } from "@/features/analytics/components/recipe-table";
import { RevenueFilters } from "@/features/analytics/components/revenue-filters";
import {
  REVENUE_FILTER_PARAM,
  parseRevenueFilters,
} from "@/features/analytics/filters";
import { sumRecipes } from "@/features/analytics/schemas";
import { listCompanySeatOptions } from "@/features/seats/api";
import { parseTableQuery, toPageMeta } from "@/lib/api/data-table";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("revenue") };
}

/**
 * Recettes journalières de l'entreprise.
 *
 * S'appuie sur `GET /daily-recipe/myCompany`, ajouté au backend avec cette
 * page : les routes existantes étaient cadrées sur **une** agence, ce qui
 * obligeait à N requêtes pour une vue consolidée — et ne donnait aucun total.
 *
 * Les totaux affichés portent sur la **page courante**, ce que dit explicitement
 * leur libellé. Un total sur l'ensemble de la période exigerait une agrégation
 * côté backend ; en attendre un ici reviendrait à afficher un chiffre faux dès
 * la deuxième page.
 */
export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("revenue");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const params = await searchParams;

  const query = parseTableQuery(params);
  const filters = parseRevenueFilters(params);
  const token = await getAuthorizedToken();

  const [page, seats] = await Promise.all([
    listCompanyRecipes(
      {
        // `toBackendQuery` n'est pas utilisé ici : `FindDailyRecipeDto` n'a ni
        // `search` ni `orderBy`, et `forbidNonWhitelisted` transformerait tout
        // paramètre en trop en 400.
        page: query.page - 1,
        count: query.perPage,
        seatId: filters.seatId,
      },
      token,
    ),
    listCompanySeatOptions(token),
  ]);

  const meta = toPageMeta(query, page);
  const totals = sumRecipes(page.items);

  const exportHref = filters.seatId
    ? `/api/exports/revenue?${REVENUE_FILTER_PARAM.seat}=${encodeURIComponent(filters.seatId)}`
    : "/api/exports/revenue";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", {
          company: session.company.name ?? tCommon("yourCompany"),
        })}
        actions={
          <Link
            href={exportHref}
            prefetch={false}
            // Téléchargement de fichier : une navigation classique, pas une
            // transition App Router — d'où `prefetch={false}` et `download`.
            download
            className={buttonVariants({ variant: "secondary" })}
          >
            <Download className="size-4" aria-hidden />
            {t("export")}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("totals.revenue")}
          value={format.number(totals.revenue, "currency")}
          icon={Wallet}
          hint={t("totals.pageScope")}
        />
        <StatCard
          label={t("totals.platformFee")}
          value={format.number(totals.platformFee, "currency")}
          hint={t("totals.pageScope")}
        />
        <StatCard
          label={t("totals.remaining")}
          value={format.number(totals.remaining, "currency")}
          hint={t("totals.remainingHint")}
        />
        <StatCard
          label={t("totals.passengers")}
          value={format.number(totals.passengers)}
          icon={Users}
          hint={t("totals.pageScope")}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="border-subtle border-b">
          <RevenueFilters filters={filters} seats={seats} />
        </div>

        <RecipeTable recipes={page.items} isFiltered={Boolean(filters.seatId)} />

        <Pagination query={query} meta={meta} itemLabel={t("itemLabel")} />
      </Card>
    </div>
  );
}
