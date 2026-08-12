"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Select } from "@/components/ui/select";
import {
  PAGE_SIZE_OPTIONS,
  buildTableHref,
  type PageMeta,
  type TableQuery,
} from "@/lib/api/data-table";
import { cn } from "@/lib/utils/cn";

type PaginationProps = {
  query: TableQuery;
  meta: PageMeta;
  /**
   * Nom des éléments listés, pour le résumé (« 1–20 sur 87 agences »).
   * Déjà traduit par l'appelant, qui seul sait de quoi la liste est faite.
   */
  itemLabel?: string;
  showPageSize?: boolean;
  className?: string;
};

/**
 * Pagination par liens.
 *
 * L'état vit dans l'URL, pas dans un `useState` : la page est partageable,
 * rechargeable et navigable au bouton « précédent » du navigateur. Chaque lien
 * déclenche un nouveau rendu serveur, donc une requête backend fraîche —
 * cohérent avec des données d'exploitation qui changent en continu.
 */
export function Pagination({
  query,
  meta,
  itemLabel,
  showPageSize = true,
  className,
}: PaginationProps) {
  const t = useTranslations("pagination");
  const pathname = usePathname();
  const router = useRouter();
  const item = itemLabel ?? t("items");

  const href = (patch: Parameters<typeof buildTableHref>[2]) =>
    buildTableHref(pathname, query, patch);

  // Une seule page et aucun résultat au-delà : la barre n'apporte rien.
  if (!meta.hasPrevious && !meta.hasNext && !showPageSize) return null;

  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "border-subtle flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm",
        className,
      )}
    >
      <p className="text-muted" aria-live="polite">
        {meta.to === 0
          ? t("noResults")
          : meta.total !== null
            ? t("rangeOf", {
                from: meta.from,
                to: meta.to,
                total: meta.total,
                item,
              })
            : t("range", { from: meta.from, to: meta.to, item })}
      </p>

      <div className="flex items-center gap-3">
        {showPageSize ? (
          <label className="text-muted flex items-center gap-2 text-xs">
            <span>{t("perPage")}</span>
            <Select
              className="h-8 w-auto py-0 text-xs"
              value={query.perPage}
              onChange={(event) =>
                router.push(href({ perPage: Number(event.target.value) }))
              }
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <div className="flex items-center gap-1">
          <PageLink
            href={href({ page: query.page - 1 })}
            disabled={!meta.hasPrevious}
            label={t("previous")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </PageLink>

          <span className="text-muted px-2 text-xs tabular-nums">
            {meta.pageCount === null
              ? t("page", { page: meta.page })
              : t("pageOf", { page: meta.page, pageCount: meta.pageCount })}
          </span>

          <PageLink
            href={href({ page: query.page + 1 })}
            disabled={!meta.hasNext}
            label={t("next")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </PageLink>
        </div>
      </div>
    </nav>
  );
}

/**
 * Un lien désactivé rendu comme `<span>` : un `<a>` sans `href` reste
 * focusable et laisse croire à une action possible.
 */
function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  const className = cn(
    "border-subtle flex size-8 items-center justify-center rounded-lg border transition-colors",
    disabled ? "text-muted/40" : "hover:bg-subtle",
  );

  if (disabled) {
    return (
      <span className={className} aria-hidden>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={className} prefetch={false}>
      {children}
    </Link>
  );
}
