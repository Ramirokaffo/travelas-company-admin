import { getLocale } from "next-intl/server";
import { NextResponse } from "next/server";

import {
  countUnreadNotifications,
  listRecentNotifications,
} from "@/features/notifications/api";
import { ApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { readAccessToken } from "@/lib/auth/cookies";

/**
 * `GET /api/notifications/summary`
 *
 * Alimente le panneau de la cloche : les dernières notifications et le nombre
 * de non-lues, en un seul aller-retour.
 *
 * Pourquoi un route handler et non une Server Action : le panneau se rafraîchit
 * à l'ouverture et à la réception d'un événement socket, sans naviguer. Une
 * Server Action rejouerait le rendu de toute la page pour deux valeurs.
 *
 * Lecture seule, donc pas d'`assertSameOrigin` : la règle 5 vise les mutations.
 * `SameSite=Lax` empêche de toute façon l'envoi du cookie depuis un autre site.
 */
export async function GET() {
  // `getSession()` interroge le backend : un compte bloqué ou déconnecté n'a
  // pas de notifications à lire, même si son cookie est encore présent.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const accessToken = await readAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const locale = await getLocale();

  try {
    const [items, unreadCount] = await Promise.all([
      listRecentNotifications(accessToken, locale),
      countUnreadNotifications(accessToken),
    ]);

    return NextResponse.json({ items, unreadCount });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    // Le détail technique reste côté serveur : la cloche se contente de ne pas
    // se mettre à jour.
    return NextResponse.json({ message: "unavailable" }, { status });
  }
}
