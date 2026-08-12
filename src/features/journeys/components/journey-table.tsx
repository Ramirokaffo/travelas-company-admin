import { ArrowRight, Route } from "lucide-react";
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
import type { Journey } from "@/features/journeys/schemas";

type JourneyTableProps = {
  journeys: Journey[];
  isFiltered: boolean;
  /** Masque la colonne « agence » sur la fiche d'une agence, où elle est constante. */
  hideSeat?: boolean;
};

/**
 * Liste des trajets — **lecture seule**.
 *
 * La création et la modification d'un trajet appartiennent au chef d'agence :
 * `POST` et `PATCH /company-journey` sont réservés à `agency_admin` et
 * `super_admin`. Le chef d'entreprise observe, il ne programme pas les départs
 * à la place de ses agences ; afficher un bouton « Modifier » ne produirait
 * qu'une 403.
 */
export async function JourneyTable({
  journeys,
  isFiltered,
  hideSeat = false,
}: JourneyTableProps) {
  const t = await getTranslations("journeys");
  const tCompany = await getTranslations("company.form.actions");
  const format = await getFormatter();

  const columnCount = hideSeat ? 4 : 5;

  return (
    <Table caption={t("tableCaption")}>
      <THead>
        <TR>
          <TH>{t("columns.route")}</TH>
          <TH>{t("columns.departure")}</TH>
          {hideSeat ? null : <TH>{t("columns.seat")}</TH>}
          <TH align="right">{t("columns.amount")}</TH>
          <TH>{t("columns.tags")}</TH>
        </TR>
      </THead>

      <TBody>
        {journeys.length === 0 ? (
          <TableMessageRow colSpan={columnCount}>
            <EmptyState
              icon={Route}
              title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
              description={t(
                isFiltered ? "empty.filteredDescription" : "empty.description",
              )}
            />
          </TableMessageRow>
        ) : (
          journeys.map((journey) => (
            <TR key={journey.id}>
              <TD>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">
                    {journey.from?.city ?? journey.from?.name ?? t("unknownPlace")}
                  </span>
                  <ArrowRight className="text-muted size-3.5 shrink-0" aria-hidden />
                  <span className="truncate font-medium">
                    {journey.to?.city ?? journey.to?.name ?? t("unknownPlace")}
                  </span>
                </div>
                <p className="text-muted truncate text-xs">
                  {[journey.from?.name, journey.to?.name].filter(Boolean).join(" → ") ||
                    t("noStation")}
                </p>
              </TD>

              <TD className="whitespace-nowrap">
                {journey.travelDate ? (
                  <time dateTime={journey.travelDate}>
                    {format.dateTime(new Date(journey.travelDate), "dateTime")}
                  </time>
                ) : (
                  <span className="text-muted">—</span>
                )}
                <p className="text-muted text-xs">
                  {t("places", { count: journey.placeCount })}
                </p>
              </TD>

              {hideSeat ? null : (
                <TD>
                  <span className="truncate">{journey.seat?.name ?? t("noSeat")}</span>
                </TD>
              )}

              <TD align="right" className="font-medium tabular-nums">
                {format.number(journey.amount, "currency")}
              </TD>

              <TD>
                <div className="flex flex-wrap gap-1.5">
                  {journey.isVIP ? <Badge variant="brand">{t("vip")}</Badge> : null}
                  {journey.repeatDaily ? <Badge>{t("daily")}</Badge> : null}
                  {journey.isHidden ? (
                    <Badge variant="warning">{t("hidden")}</Badge>
                  ) : null}
                  <Badge>{tCompany(journey.allowedAction)}</Badge>
                </div>
              </TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
