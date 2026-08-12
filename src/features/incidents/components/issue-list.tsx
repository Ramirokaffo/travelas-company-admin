import { AlertTriangle, ImageIcon, MapPin } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IssueResolutionButton } from "@/features/incidents/components/issue-resolution-button";
import type { Issue } from "@/features/incidents/schemas";

type IssueListProps = {
  issues: Issue[];
  isFiltered: boolean;
  /** `false` sur la fiche d'une agence, où la liste n'est qu'un aperçu. */
  actionable?: boolean;
};

/**
 * Signalements — liste plutôt que tableau.
 *
 * Un signalement est d'abord un **texte libre** : le mettre dans une cellule de
 * tableau le tronquerait, alors que c'est justement ce qu'il faut lire pour
 * décider. Les métadonnées (agence, date, auteur) passent en dessous.
 */
export async function IssueList({
  issues,
  isFiltered,
  actionable = true,
}: IssueListProps) {
  const t = await getTranslations("incidents");
  const format = await getFormatter();

  if (issues.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t(isFiltered ? "empty.filteredTitle" : "empty.title")}
        description={t(isFiltered ? "empty.filteredDescription" : "empty.description")}
      />
    );
  }

  return (
    <ul className="divide-subtle divide-y">
      {issues.map((issue) => (
        <li key={issue.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
          <div className="min-w-64 flex-1 space-y-2">
            <p className="text-sm">{issue.description}</p>

            <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {issue.seat?.name ?? t("unknownSeat")}
              </span>

              {issue.createdAt ? (
                <time dateTime={issue.createdAt}>
                  {format.dateTime(new Date(issue.createdAt), "dateTime")}
                </time>
              ) : null}

              {/* `reporter` est `null` quand le voyageur a demandé l'anonymat :
                  son identité n'a alors même pas quitté le serveur. */}
              <span>{issue.reporter?.name || t("anonymous")}</span>

              {issue.imageCount > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <ImageIcon className="size-3.5" aria-hidden />
                  {t("imageCount", { count: issue.imageCount })}
                </span>
              ) : null}
            </div>

            {issue.isResolved && issue.resolutionNote ? (
              <p className="bg-subtle text-muted rounded-lg px-3 py-2 text-xs">
                {t("resolutionNote", { note: issue.resolutionNote })}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {issue.isResolved ? (
              <Badge variant="success">{t("resolved")}</Badge>
            ) : (
              <Badge variant="warning">{t("open")}</Badge>
            )}
            {actionable ? <IssueResolutionButton issue={issue} /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
