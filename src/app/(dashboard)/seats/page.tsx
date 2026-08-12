import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { listAgencyOptions } from "@/features/agencies/api";
import { SEAT_WINDOW, listCompanySeats } from "@/features/seats/api";
import { CreateSeatButton } from "@/features/seats/components/create-seat-button";
import { SeatFilters } from "@/features/seats/components/seat-filters";
import { SeatTable } from "@/features/seats/components/seat-table";
import { selectSeatPage } from "@/features/seats/list";
import { parseSeatFilters } from "@/features/seats/schemas";
import { parseTableQuery, toPageMeta } from "@/lib/api/data-table";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("seats") };
}

/**
 * Gestion des agences de l'entreprise (`SeatEntity`).
 *
 * `parseTableQuery` est appelé **sans `sortableColumns`** : l'endpoint ne trie
 * pas, l'ordre est imposé par `selectSeatPage()` (agence principale d'abord,
 * puis alphabétique). Recherche, filtre et pagination sont appliqués en mémoire
 * — voir `features/seats/list.ts` pour l'arbitrage.
 */
export default async function SeatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("seats");
  const tCommon = await getTranslations("common");
  const params = await searchParams;

  const query = parseTableQuery(params);
  const filters = parseSeatFilters(params);
  const token = await getAuthorizedToken();

  const [{ seats, truncated }, agencies] = await Promise.all([
    listCompanySeats(token),
    // Le référentiel des gares alimente le formulaire de création : il est donc
    // chargé même quand la liste est vide, puisque c'est justement ce cas qui
    // mène à une création.
    listAgencyOptions(token),
  ]);

  const page = selectSeatPage(seats, query, filters, await getLocale());
  const meta = toPageMeta(query, page);
  const isFiltered = Boolean(query.search || filters.status !== "all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-muted mt-1 text-sm">
            {t("subtitle", {
              company: session.company.name ?? tCommon("yourCompany"),
            })}
          </p>
        </div>

        <CreateSeatButton agencies={agencies} />
      </div>

      {truncated ? (
        <p
          role="status"
          className="bg-warning/10 text-warning flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("truncated", { limit: String(SEAT_WINDOW) })}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-subtle border-b">
          <SeatFilters query={query} filters={filters} />
        </div>

        <SeatTable seats={page.items} agencies={agencies} isFiltered={isFiltered} />

        <Pagination query={query} meta={meta} itemLabel={t("itemLabel")} />
      </Card>
    </div>
  );
}
