import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListFilters } from "@/components/layout/list-filters";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { listCompanyJourneys } from "@/features/journeys/api";
import { JourneyTable } from "@/features/journeys/components/journey-table";
import {
  JOURNEY_FILTER_PARAM,
  JOURNEY_SORTABLE,
  parseJourneyFilters,
} from "@/features/journeys/schemas";
import { listCompanySeatOptions } from "@/features/seats/api";
import { parseTableQuery, toPageMeta } from "@/lib/api/data-table";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("journeys") };
}

/**
 * Trajets de l'entreprise — lecture seule.
 *
 * Pas de champ de recherche : `FindCompanyJourneyDto` n'expose pas `search`, et
 * le `ValidationPipe` global (`forbidNonWhitelisted`) transformerait le
 * paramètre en 400 plutôt que de l'ignorer. Le filtrage passe donc par l'agence,
 * la visibilité et la classe — tous trois présents dans le DTO.
 *
 * Le tri, lui, est disponible : `orderBy` accepte `CompanyJourneyFilterEnum`,
 * dont `JOURNEY_SORTABLE` est le sous-ensemble utile.
 */
export default async function JourneysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("journeys");
  const tCommon = await getTranslations("common");
  const tSeats = await getTranslations("seats");
  const params = await searchParams;

  const query = parseTableQuery(params, {
    sortableColumns: JOURNEY_SORTABLE,
    defaultSortBy: "travelDate",
    defaultSortOrder: "desc",
  });
  const filters = parseJourneyFilters(params);
  const token = await getAuthorizedToken();

  const [page, seats] = await Promise.all([
    listCompanyJourneys(query, filters, token),
    listCompanySeatOptions(token),
  ]);

  const meta = toPageMeta(query, page);
  const isFiltered =
    Boolean(filters.seatId) ||
    filters.visibility !== "all" ||
    filters.travelClass !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", {
          company: session.company.name ?? tCommon("yourCompany"),
        })}
      />

      <Card className="overflow-hidden">
        <div className="border-subtle border-b">
          <ListFilters
            id="journeys"
            selects={[
              {
                param: JOURNEY_FILTER_PARAM.seat,
                label: t("filters.seat"),
                value: filters.seatId ?? "",
                className: "w-56",
                options: [
                  { value: "", label: t("filters.allSeats") },
                  ...seats.map((seat) => ({
                    value: seat.id,
                    label: seat.name ?? tSeats("unnamed"),
                  })),
                ],
              },
              {
                param: JOURNEY_FILTER_PARAM.visibility,
                label: t("filters.visibility"),
                value: filters.visibility === "all" ? "" : filters.visibility,
                options: [
                  { value: "", label: t("filters.allVisibilities") },
                  { value: "visible", label: t("filters.visible") },
                  { value: "hidden", label: t("filters.hidden") },
                ],
              },
              {
                param: JOURNEY_FILTER_PARAM.travelClass,
                label: t("filters.class"),
                value: filters.travelClass === "all" ? "" : filters.travelClass,
                options: [
                  { value: "", label: t("filters.allClasses") },
                  { value: "vip", label: t("filters.vip") },
                  { value: "standard", label: t("filters.standard") },
                ],
              },
            ]}
          />
        </div>

        <JourneyTable journeys={page.items} isFiltered={isFiltered} />

        <Pagination query={query} meta={meta} itemLabel={t("itemLabel")} />
      </Card>
    </div>
  );
}
