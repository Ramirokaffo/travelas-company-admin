"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  STAFF_FILTER_PARAM,
  STAFF_ROLES,
  type StaffFilters as StaffFiltersValue,
} from "@/features/staff/schemas";
import { DEFAULT_PAGE_SIZE, TABLE_PARAM, type TableQuery } from "@/lib/api/data-table";

type StaffFiltersProps = {
  query: TableQuery;
  filters: StaffFiltersValue;
};

/**
 * Barre de recherche et de filtres.
 *
 * Les critères vivent dans l'URL : la vue est partageable, rechargeable, et
 * chaque changement déclenche un rendu serveur — donc une requête backend
 * fraîche, plutôt qu'un filtrage côté client sur une page déjà chargée.
 */
export function StaffFilters({ query, filters }: StaffFiltersProps) {
  const t = useTranslations("staff.filters");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("roles");
  const router = useRouter();
  const pathname = usePathname();

  const navigate = (patch: Record<string, string>) => {
    const params = new URLSearchParams();

    const next = {
      [TABLE_PARAM.search]: query.search ?? "",
      [STAFF_FILTER_PARAM.role]: filters.role ?? "",
      [STAFF_FILTER_PARAM.status]: filters.status === "all" ? "" : filters.status,
      ...patch,
    };

    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    // Tout changement de critère ramène en page 1 : rester en page 4 après un
    // filtrage affiche un écran vide.
    if (query.perPage !== DEFAULT_PAGE_SIZE) {
      params.set(TABLE_PARAM.perPage, String(query.perPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const hasFilters = Boolean(query.search || filters.role || filters.status !== "all");

  return (
    <div className="flex flex-wrap items-end gap-3 px-4 py-3">
      <form
        className="flex min-w-56 flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get(TABLE_PARAM.search);
          navigate({ [TABLE_PARAM.search]: String(value ?? "").trim() });
        }}
      >
        <label htmlFor="staff-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="relative flex-1">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          {/* Champ non contrôlé : la recherche appliquée est celle de l'URL.
              La `key` le resynchronise après un retour arrière ou une
              réinitialisation, sans effet ni état miroir. */}
          <Input
            key={query.search ?? ""}
            id="staff-search"
            name={TABLE_PARAM.search}
            type="search"
            defaultValue={query.search ?? ""}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" size="md">
          {tCommon("search")}
        </Button>
      </form>

      <div className="flex items-end gap-2">
        <label className="text-muted flex flex-col gap-1 text-xs">
          <span>{t("role")}</span>
          <Select
            className="w-40"
            value={filters.role ?? ""}
            onChange={(event) =>
              navigate({ [STAFF_FILTER_PARAM.role]: event.target.value })
            }
          >
            <option value="">{t("allRoles")}</option>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {tRoles(role)}
              </option>
            ))}
          </Select>
        </label>

        <label className="text-muted flex flex-col gap-1 text-xs">
          <span>{t("status")}</span>
          <Select
            className="w-36"
            value={filters.status}
            onChange={(event) =>
              navigate({
                [STAFF_FILTER_PARAM.status]:
                  event.target.value === "all" ? "" : event.target.value,
              })
            }
          >
            <option value="all">{t("allStatuses")}</option>
            <option value="active">{t("active")}</option>
            <option value="blocked">{t("blocked")}</option>
          </Select>
        </label>

        {hasFilters ? (
          <Button variant="ghost" onClick={() => router.push(pathname)}>
            <X className="size-4" aria-hidden />
            {tCommon("reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
