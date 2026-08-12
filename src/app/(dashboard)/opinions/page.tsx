import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { ListFilters } from "@/components/layout/list-filters";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Rating } from "@/components/ui/rating";
import { listCompanyOpinions } from "@/features/opinions/api";
import { OPINION_FILTER_PARAM, parseOpinionFilters } from "@/features/opinions/schemas";
import { TABLE_PARAM, parseTableQuery, toPageMeta } from "@/lib/api/data-table";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("opinions") };
}

/**
 * Avis laissés par les voyageurs.
 *
 * Lecture seule, et c'est volontaire autant que technique : `PATCH` et
 * `DELETE /opinion/:id` sont réservés au `super_admin`. Une entreprise qui
 * pourrait effacer ses mauvaises notes viderait la notation de son sens.
 *
 * L'auteur est réduit à un prénom et une initiale par `toOpinion()` : le nom
 * complet d'un voyageur n'a pas d'usage ici.
 */
export default async function OpinionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const t = await getTranslations("opinions");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const params = await searchParams;

  const query = parseTableQuery(params);
  const filters = parseOpinionFilters(params);
  const token = await getAuthorizedToken();

  const page = await listCompanyOpinions(query, filters, token);
  const meta = toPageMeta(query, page);
  const isFiltered = Boolean(query.search) || filters.rating !== "all";

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
            id="opinions"
            search={{
              param: TABLE_PARAM.search,
              value: query.search ?? "",
              label: t("filters.searchLabel"),
              placeholder: t("filters.searchPlaceholder"),
            }}
            selects={[
              {
                param: OPINION_FILTER_PARAM.rating,
                label: t("filters.rating"),
                value: filters.rating === "all" ? "" : filters.rating,
                options: [
                  { value: "", label: t("filters.allRatings") },
                  { value: "positive", label: t("filters.positive") },
                  { value: "neutral", label: t("filters.neutral") },
                  { value: "negative", label: t("filters.negative") },
                ],
              },
            ]}
          />
        </div>

        {page.items.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
            description={t(
              isFiltered ? "empty.filteredDescription" : "empty.description",
            )}
          />
        ) : (
          <ul className="divide-subtle divide-y">
            {page.items.map((opinion) => (
              <li key={opinion.id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Rating
                    value={opinion.rating}
                    label={t("ratingLabel", {
                      rating: format.number(opinion.rating),
                    })}
                  />
                  <p className="text-muted text-xs">
                    {opinion.author ?? t("anonymous")}
                    {opinion.createdAt ? (
                      <>
                        {" · "}
                        <time dateTime={opinion.createdAt}>
                          {format.dateTime(new Date(opinion.createdAt), "date")}
                        </time>
                      </>
                    ) : null}
                  </p>
                </div>

                {opinion.comment ? (
                  <p className="text-sm">{opinion.comment}</p>
                ) : (
                  <p className="text-muted text-sm italic">{t("noComment")}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <Pagination query={query} meta={meta} itemLabel={t("itemLabel")} />
      </Card>
    </div>
  );
}
