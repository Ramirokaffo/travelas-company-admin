"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

export type FilterSelect = {
  /** Nom du paramètre d'URL. La valeur vide retire le paramètre. */
  param: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
};

type ListFiltersProps = {
  /** Champ de recherche. Absent quand l'endpoint backend n'en accepte pas. */
  search?: { param: string; value: string; placeholder: string; label: string };
  selects?: FilterSelect[];
  /** Identifiant du champ de recherche, à rendre unique si deux barres coexistent. */
  id?: string;
};

/**
 * Barre de filtres générique.
 *
 * Les critères vivent dans l'URL : la vue est partageable, rechargeable et
 * navigable au bouton « précédent ». Chaque changement relance un rendu serveur,
 * donc une lecture fraîche du backend — le comportement attendu de données
 * d'exploitation.
 *
 * Les paramètres non gérés par cette barre (période, taille de page) sont
 * **conservés** ; seul `page` est effacé, parce que rester en page 4 après un
 * filtrage afficherait un écran vide.
 *
 * Écrite une fois et partagée par toutes les listes plutôt que recopiée par
 * page : c'est ce qui garantit que « réinitialiser » se comporte partout de la
 * même façon.
 */
export function ListFilters({ search, selects = [], id = "list" }: ListFiltersProps) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    params.delete("page");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const hasFilters =
    Boolean(search?.value) || selects.some((select) => Boolean(select.value));

  const reset = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.delete(search.param);
    for (const select of selects) params.delete(select.param);
    params.delete("page");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 px-4 py-3">
      {search ? (
        <form
          className="flex min-w-56 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get(search.param);
            navigate({ [search.param]: String(value ?? "").trim() });
          }}
        >
          <label htmlFor={`${id}-search`} className="sr-only">
            {search.label}
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
              key={search.value}
              id={`${id}-search`}
              name={search.param}
              type="search"
              defaultValue={search.value}
              placeholder={search.placeholder}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            {t("search")}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        {selects.map((select) => (
          <label key={select.param} className="text-muted flex flex-col gap-1 text-xs">
            <span>{select.label}</span>
            <Select
              className={select.className ?? "w-40"}
              value={select.value}
              onChange={(event) => navigate({ [select.param]: event.target.value })}
            >
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        ))}

        {hasFilters ? (
          <Button variant="ghost" onClick={reset}>
            <X className="size-4" aria-hidden />
            {t("reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
