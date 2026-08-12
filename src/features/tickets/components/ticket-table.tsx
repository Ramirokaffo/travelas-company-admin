import { ArrowRight, Ticket as TicketIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableMessageRow,
} from "@/components/ui/table";
import type { Ticket } from "@/features/tickets/schemas";

type TicketTableProps = {
  tickets: Ticket[];
  isFiltered: boolean;
  hideSeat?: boolean;
};

/**
 * Liste des billets — **lecture seule**.
 *
 * `PATCH /ticket/:id` est réservé au voyageur, au chef d'agence et à l'agent :
 * c'est l'embarquement qui valide un billet, pas le siège social.
 *
 * Le montant affiché est `paidAmount` — ce que le voyageur a réellement réglé —
 * et non `amount`, qui ignore les frais. Les deux se ressemblent assez pour
 * qu'une confusion passe inaperçue jusqu'au rapprochement comptable.
 */
export async function TicketTable({
  tickets,
  isFiltered,
  hideSeat = false,
}: TicketTableProps) {
  const t = await getTranslations("tickets");
  const format = await getFormatter();

  const columnCount = hideSeat ? 4 : 5;

  return (
    <Table caption={t("tableCaption")}>
      <THead>
        <TR>
          <TH>{t("columns.buyer")}</TH>
          <TH>{t("columns.route")}</TH>
          {hideSeat ? null : <TH>{t("columns.seat")}</TH>}
          <TH align="right">{t("columns.amount")}</TH>
          <TH>{t("columns.status")}</TH>
        </TR>
      </THead>

      <TBody>
        {tickets.length === 0 ? (
          <TableMessageRow colSpan={columnCount}>
            <EmptyState
              icon={TicketIcon}
              title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
              description={t(
                isFiltered ? "empty.filteredDescription" : "empty.description",
              )}
            />
          </TableMessageRow>
        ) : (
          tickets.map((ticket) => (
            <TR key={ticket.id}>
              <TD>
                <p className="truncate font-medium">
                  {ticket.buyer?.name || t("unknownBuyer")}
                </p>
                <p className="text-muted truncate text-xs">
                  {ticket.buyer?.phoneNumber ?? "—"}
                </p>
              </TD>

              <TD>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{ticket.from ?? "—"}</span>
                  <ArrowRight className="text-muted size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{ticket.to ?? "—"}</span>
                </div>
                <p className="text-muted truncate text-xs">
                  {ticket.travelDate
                    ? format.dateTime(new Date(ticket.travelDate), "dateTime")
                    : "—"}
                </p>
              </TD>

              {hideSeat ? null : (
                <TD>
                  <span className="truncate">{ticket.seat?.name ?? "—"}</span>
                </TD>
              )}

              <TD align="right">
                <p className="font-medium tabular-nums">
                  {format.number(ticket.paidAmount, "currency")}
                </p>
                <p className="text-muted text-xs tabular-nums">
                  {t("places", { count: ticket.placeCount })}
                </p>
              </TD>

              <TD>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.isPaid ? (
                    <Badge variant="success">{t("paid")}</Badge>
                  ) : (
                    <Badge variant="warning">{t("unpaid")}</Badge>
                  )}
                  {ticket.isReservation ? <Badge>{t("reservation")}</Badge> : null}
                  {ticket.validatedCount > 0 ? (
                    <Badge variant="brand">
                      {t("validated", { count: ticket.validatedCount })}
                    </Badge>
                  ) : null}
                </div>
              </TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
