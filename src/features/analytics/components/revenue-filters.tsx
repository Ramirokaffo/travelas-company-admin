"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  REVENUE_FILTER_PARAM,
  type RevenueFilters as RevenueFiltersValue,
} from "@/features/analytics/filters";
import type { SeatOption } from "@/features/seats/schemas";

type RevenueFiltersProps = {
  filters: RevenueFiltersValue;
  seats: SeatOption[];
};

/**
 * Filtre d'agence des pages de recettes.
 *
 * Les autres paramètres de l'URL — période, page, taille de page — sont
 * conservés à l'exception de `page` : changer d'agence rebat les résultats, et
 * rester en page 4 afficherait un écran vide.
 */
export function RevenueFilters({ filters, seats }: RevenueFiltersProps) {
  const t = useTranslations("revenue.filters");
  const tCommon = useTranslations("common");
  const tSeats = useTranslations("seats");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (seatId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (seatId) {
      params.set(REVENUE_FILTER_PARAM.seat, seatId);
    } else {
      params.delete(REVENUE_FILTER_PARAM.seat);
    }
    params.delete("page");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 px-4 py-3">
      <label className="text-muted flex flex-col gap-1 text-xs">
        <span>{t("seat")}</span>
        <Select
          className="w-64"
          value={filters.seatId ?? ""}
          onChange={(event) => navigate(event.target.value)}
        >
          <option value="">{t("allSeats")}</option>
          {seats.map((seat) => (
            <option key={seat.id} value={seat.id}>
              {seat.name ?? tSeats("unnamed")}
            </option>
          ))}
        </Select>
      </label>

      {filters.seatId ? (
        <Button variant="ghost" onClick={() => navigate("")}>
          <X className="size-4" aria-hidden />
          {tCommon("reset")}
        </Button>
      ) : null}
    </div>
  );
}
