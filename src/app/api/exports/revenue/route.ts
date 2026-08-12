import { getFormatter, getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";

import { listCompanyRecipes } from "@/features/analytics/api";
import { toCsvDocument } from "@/features/analytics/csv";
import { REVENUE_FILTER_PARAM } from "@/features/analytics/filters";
import { ApiError } from "@/lib/api/errors";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

/**
 * Export CSV des recettes journalières.
 *
 * Route handler et non Server Action : le résultat est un **fichier**, pas une
 * mise à jour d'interface. Un `<a download>` suffit alors côté navigateur.
 *
 * `GET /statistics/export` du backend n'est pas utilisé : il renvoie un objet
 * `{ message: "Export CSV en cours de préparation" }` — un squelette qui ne
 * produit aucun fichier. Le CSV est donc assemblé ici, à partir des mêmes
 * données que la page `/revenue`.
 *
 * Sécurité : `requireCompanySession()` est appelé en première ligne. Un route
 * handler est un point d'entrée HTTP indépendant — le layout `(dashboard)` ne
 * le protège pas. Pas de `assertSameOrigin()` en revanche : la vérification
 * d'origine protège des **mutations** déclenchées depuis un autre site, et un
 * navigateur n'envoie pas les cookies `SameSite=Lax` sur une requête
 * inter-sites de toute façon.
 */

/** Plafond d'export : au-delà, la requête devient une opération de fond. */
const EXPORT_LIMIT = 1000;
const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  await requireCompanySession();

  const seatId = request.nextUrl.searchParams.get(REVENUE_FILTER_PARAM.seat);
  const t = await getTranslations("revenue.csv");
  const format = await getFormatter();

  const rows: (string | number)[][] = [];

  try {
    const token = await getAuthorizedToken();

    // Pagination jusqu'au plafond : l'endpoint borne lui-même la taille de page
    // à 100, une requête unique de 1 000 lignes n'existe donc pas.
    for (let page = 0; page * PAGE_SIZE < EXPORT_LIMIT; page += 1) {
      const result = await listCompanyRecipes(
        { page, count: PAGE_SIZE, seatId, withCount: false },
        token,
      );

      for (const recipe of result.items) {
        rows.push([
          recipe.date ? format.dateTime(new Date(recipe.date), "dateShort") : "",
          recipe.seat?.name ?? "",
          recipe.revenue,
          recipe.platformFee,
          recipe.seatFee,
          recipe.remaining,
          recipe.passengers,
          recipe.validTickets,
        ]);
      }

      if (result.items.length < PAGE_SIZE) break;
    }
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    return NextResponse.json({ message: "errors.unavailable" }, { status });
  }

  const csv = toCsvDocument(
    [
      t("date"),
      t("seat"),
      t("revenue"),
      t("platformFee"),
      t("seatFee"),
      t("remaining"),
      t("passengers"),
      t("validTickets"),
    ],
    rows,
  );

  const fileName = `travelas-recettes-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // Des données financières n'ont rien à faire dans un cache partagé.
      "Cache-Control": "no-store",
    },
  });
}
