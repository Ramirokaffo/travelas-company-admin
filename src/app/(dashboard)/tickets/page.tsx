import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListFilters } from "@/components/layout/list-filters";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { listCompanySeatOptions } from "@/features/seats/api";
import { listCompanyTickets } from "@/features/tickets/api";
import { TicketTable } from "@/features/tickets/components/ticket-table";
import { TICKET_FILTER_PARAM, parseTicketFilters } from "@/features/tickets/schemas";
import { TABLE_PARAM, parseTableQuery, toPageMeta } from "@/lib/api/data-table";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("tickets") };
}

/**
 * Billets de l'entreprise — lecture seule.
 *
 * La recherche porte, côté backend, sur l'acheteur, les passagers, les gares et
 * le nom de l'entreprise : c'est le seul endpoint de liste du projet à
 * l'accepter. Le tri, en revanche, n'est pas exposé — voir `features/tickets/api.ts`.
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("tickets");
  const tCommon = await getTranslations("common");
  const tSeats = await getTranslations("seats");
  const params = await searchParams;

  const query = parseTableQuery(params);
  const filters = parseTicketFilters(params);
  const token = await getAuthorizedToken();

  const [page, seats] = await Promise.all([
    listCompanyTickets(query, filters, token),
    listCompanySeatOptions(token),
  ]);

  const meta = toPageMeta(query, page);
  const isFiltered =
    Boolean(query.search) ||
    Boolean(filters.seatId) ||
    filters.payment !== "all" ||
    filters.kind !== "all";

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
            id="tickets"
            search={{
              param: TABLE_PARAM.search,
              value: query.search ?? "",
              label: t("filters.searchLabel"),
              placeholder: t("filters.searchPlaceholder"),
            }}
            selects={[
              {
                param: TICKET_FILTER_PARAM.seat,
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
                param: TICKET_FILTER_PARAM.payment,
                label: t("filters.payment"),
                value: filters.payment === "all" ? "" : filters.payment,
                options: [
                  { value: "", label: t("filters.allPayments") },
                  { value: "paid", label: t("paid") },
                  { value: "unpaid", label: t("unpaid") },
                ],
              },
              {
                param: TICKET_FILTER_PARAM.kind,
                label: t("filters.kind"),
                value: filters.kind === "all" ? "" : filters.kind,
                options: [
                  { value: "", label: t("filters.allKinds") },
                  { value: "purchase", label: t("filters.purchase") },
                  { value: "reservation", label: t("reservation") },
                ],
              },
            ]}
          />
        </div>

        <TicketTable tickets={page.items} isFiltered={isFiltered} />

        <Pagination query={query} meta={meta} itemLabel={t("itemLabel")} />
      </Card>
    </div>
  );
}
