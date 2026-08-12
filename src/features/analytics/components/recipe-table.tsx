import { Wallet } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

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
import type { DailyRecipe } from "@/features/analytics/schemas";

type RecipeTableProps = {
  recipes: DailyRecipe[];
  /** `true` si un filtre est actif : change le message d'état vide. */
  isFiltered: boolean;
};

/**
 * Recettes journalières, une ligne par agence et par jour.
 *
 * Les montants sont alignés à droite et en chiffres tabulaires : c'est ce qui
 * permet de comparer deux lignes à la verticale sans les lire.
 */
export async function RecipeTable({ recipes, isFiltered }: RecipeTableProps) {
  const t = await getTranslations("revenue");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  return (
    <Table caption={t("tableCaption")}>
      <THead>
        <TR>
          <TH>{t("columns.date")}</TH>
          <TH>{t("columns.seat")}</TH>
          <TH align="right">{t("columns.revenue")}</TH>
          <TH align="right">{t("columns.platformFee")}</TH>
          <TH align="right">{t("columns.remaining")}</TH>
          <TH align="right">{t("columns.passengers")}</TH>
        </TR>
      </THead>

      <TBody>
        {recipes.length === 0 ? (
          <TableMessageRow colSpan={6}>
            <EmptyState
              icon={Wallet}
              title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
              description={t(
                isFiltered ? "empty.filteredDescription" : "empty.description",
              )}
            />
          </TableMessageRow>
        ) : (
          recipes.map((recipe) => (
            <TR key={recipe.id}>
              <TD className="whitespace-nowrap">
                {recipe.date ? (
                  <time dateTime={recipe.date}>
                    {format.dateTime(new Date(recipe.date), "date")}
                  </time>
                ) : (
                  <span className="text-muted">{tCommon("unknown")}</span>
                )}
              </TD>
              <TD>
                <span className="truncate">
                  {recipe.seat?.name ?? t("unnamedSeat")}
                </span>
              </TD>
              <TD align="right" className="font-medium tabular-nums">
                {format.number(recipe.revenue, "currency")}
              </TD>
              <TD align="right" className="text-muted tabular-nums">
                {format.number(recipe.platformFee, "currency")}
              </TD>
              <TD align="right" className="tabular-nums">
                {format.number(recipe.remaining, "currency")}
              </TD>
              <TD align="right" className="tabular-nums">
                {format.number(recipe.passengers)}
              </TD>
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
