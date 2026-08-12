import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
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
import type { AgencyOption } from "@/features/agencies/schemas";
import { SeatRowActions } from "@/features/seats/components/seat-row-actions";
import type { SeatSummary } from "@/features/seats/schemas";

type SeatTableProps = {
  seats: SeatSummary[];
  agencies: AgencyOption[];
  /** `true` si un filtre est actif : change le message d'état vide. */
  isFiltered: boolean;
};

/** Server Component : seules les actions de ligne sont interactives. */
export async function SeatTable({ seats, agencies, isFiltered }: SeatTableProps) {
  const t = await getTranslations("seats");
  const tCommon = await getTranslations("common");

  return (
    <Table caption={t("tableCaption")}>
      <THead>
        <TR>
          <TH>{t("columns.seat")}</TH>
          <TH>{t("columns.agency")}</TH>
          <TH>{t("columns.services")}</TH>
          <TH>{t("columns.status")}</TH>
          <TH align="right">
            <span className="sr-only">{tCommon("actions")}</span>
          </TH>
        </TR>
      </THead>

      <TBody>
        {seats.length === 0 ? (
          <TableMessageRow colSpan={5}>
            <EmptyState
              icon={MapPin}
              title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
              description={t(
                isFiltered ? "empty.filteredDescription" : "empty.description",
              )}
            />
          </TableMessageRow>
        ) : (
          seats.map((seat) => (
            <TR key={seat.id}>
              <TD>
                <div className="min-w-0">
                  {/* Le nom mène à la fiche détaillée : c'est la cible naturelle
                      d'un clic sur une ligne, et un lien reste ouvrable dans un
                      nouvel onglet — ce qu'un gestionnaire de clic sur la ligne
                      entière ne permettrait pas. */}
                  <Link
                    href={`${ROUTES.seats}/${seat.id}`}
                    className="hover:text-brand-700 dark:hover:text-brand-300 truncate font-medium"
                  >
                    {seat.name ?? t("unnamed")}
                  </Link>
                  <p className="text-muted truncate text-xs">
                    {seat.street ?? t("noStreet")}
                  </p>
                </div>
              </TD>

              <TD>
                {seat.agency ? (
                  <div className="min-w-0">
                    <p className="truncate">{seat.agency.name ?? t("unnamedAgency")}</p>
                    <p className="text-muted truncate text-xs">
                      {seat.agency.city ?? t("unknownCity")}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted">{t("noAgency")}</span>
                )}
              </TD>

              <TD>
                <div className="flex flex-wrap gap-1.5">
                  {seat.hasBedroom ? <Badge>{t("services.bedroom")}</Badge> : null}
                  {/* `null` = l'agence suit le réglage de l'entreprise : on
                      n'affiche alors rien plutôt qu'une valeur inventée. */}
                  {seat.allowSeatNumberBook === true ? (
                    <Badge>{t("services.seatNumberBook")}</Badge>
                  ) : null}
                  {seat.allowSeatNumberBook === false ? (
                    <Badge>{t("services.noSeatNumberBook")}</Badge>
                  ) : null}
                </div>
              </TD>

              <TD>
                <div className="flex flex-wrap gap-1.5">
                  {seat.isActive ? (
                    <Badge variant="success">{t("statusValues.active")}</Badge>
                  ) : (
                    <Badge variant="warning">{t("statusValues.inactive")}</Badge>
                  )}
                  {seat.isMain ? <Badge variant="brand">{t("main")}</Badge> : null}
                </div>
              </TD>

              <TD align="right">
                <SeatRowActions seat={seat} agencies={agencies} />
              </TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
