import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { issueSocketTicket } from "@/features/notifications/api";
import { ApiError } from "@/lib/api/errors";
import { readAccessToken } from "@/lib/auth/cookies";
import { getSession } from "@/lib/auth/session";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";

/**
 * `POST /api/notifications/socket-ticket`
 *
 * Échange le cookie de session — inaccessible à JavaScript — contre un ticket
 * opaque à usage unique, valable 60 s, que le navigateur présente au handshake
 * socket.io.
 *
 * C'est ce qui permet le temps réel **sans** enfreindre la règle 3 : le JWT ne
 * quitte jamais le serveur. Un ticket volé n'ouvre qu'un socket, une fois, dans
 * la minute — et ne donne accès à aucune route de l'API.
 *
 * `POST` et non `GET` : la délivrance consomme un jeton côté backend, et
 * `assertSameOrigin` n'a de sens que sur une méthode non simple.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      const t = await getTranslations();
      return NextResponse.json({ message: t(error.message) }, { status: 403 });
    }
    throw error;
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const accessToken = await readAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  try {
    const ticket = await issueSocketTicket(accessToken);
    return NextResponse.json(ticket);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    return NextResponse.json({ message: "unavailable" }, { status });
  }
}
