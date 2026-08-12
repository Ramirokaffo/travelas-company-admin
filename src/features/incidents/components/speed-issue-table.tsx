import { Gauge } from "lucide-react";
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
import type { SpeedIssue } from "@/features/incidents/schemas";

/**
 * Excès de vitesse relevés par l'application mobile.
 *
 * Lecture seule : `PATCH` et `DELETE /speed-issue/:id` sont réservés au
 * `super_admin`, et un relevé automatique n'a pas à être corrigé par la partie
 * qu'il met en cause.
 *
 * Le seuil d'alerte est fixé à 100 km/h — au-delà, la ligne est signalée en
 * rouge. Le backend n'en définit aucun ; c'est donc une convention d'affichage,
 * et non une règle métier, d'où sa place ici et non dans le schéma.
 */
const ALERT_SPEED = 100;

export async function SpeedIssueTable({
  issues,
  isFiltered,
}: {
  issues: SpeedIssue[];
  isFiltered: boolean;
}) {
  const t = await getTranslations("incidents.speeding");
  const format = await getFormatter();

  return (
    <Table caption={t("tableCaption")}>
      <THead>
        <TR>
          <TH align="right">{t("columns.speed")}</TH>
          <TH>{t("columns.location")}</TH>
          <TH>{t("columns.date")}</TH>
          <TH>{t("columns.reporter")}</TH>
        </TR>
      </THead>

      <TBody>
        {issues.length === 0 ? (
          <TableMessageRow colSpan={4}>
            <EmptyState
              icon={Gauge}
              title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
              description={t(
                isFiltered ? "empty.filteredDescription" : "empty.description",
              )}
            />
          </TableMessageRow>
        ) : (
          issues.map((issue) => (
            <TR key={issue.id}>
              <TD align="right">
                {/* La couleur ne porte jamais seule l'information : au-delà du
                    seuil, l'étiquette « excès » double le rouge. */}
                <span className="font-medium tabular-nums">
                  {t("speedValue", { speed: format.number(issue.speed) })}
                </span>
                {issue.speed >= ALERT_SPEED ? (
                  <Badge variant="danger" className="ml-2">
                    {t("over")}
                  </Badge>
                ) : null}
              </TD>

              <TD>
                <p className="truncate">{issue.street ?? t("unknownStreet")}</p>
                <p className="text-muted truncate text-xs tabular-nums">
                  {t("coordinates", {
                    lat: issue.lat.toFixed(4),
                    long: issue.long.toFixed(4),
                  })}
                </p>
              </TD>

              <TD className="whitespace-nowrap">
                {issue.createdAt ? (
                  <time dateTime={issue.createdAt}>
                    {format.dateTime(new Date(issue.createdAt), "dateTime")}
                  </time>
                ) : (
                  "—"
                )}
              </TD>

              <TD>
                <span className="truncate">{issue.reporter ?? t("anonymous")}</span>
              </TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
