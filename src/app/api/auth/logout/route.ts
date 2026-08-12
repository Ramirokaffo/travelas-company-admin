import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { logout } from "@/features/auth/api";
import { clearSessionCookies, readAccessToken } from "@/lib/auth/cookies";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";

/**
 * `POST /api/auth/logout`
 *
 * Invalide la session côté backend (`isLoggedOut = true`, ce qui fait échouer
 * la `JwtStrategy` même si le token n'a pas expiré) PUIS efface les cookies.
 * Les cookies sont effacés même si l'appel backend échoue : côté navigateur,
 * la déconnexion doit toujours aboutir.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      // `error.message` est une clé de catalogue (voir `lib/security/origin`).
      const t = await getTranslations();
      return NextResponse.json({ message: t(error.message) }, { status: 403 });
    }
    throw error;
  }

  const accessToken = await readAccessToken();

  if (accessToken) {
    // Best-effort : un backend indisponible ne doit pas bloquer l'utilisateur.
    await logout(accessToken).catch(() => undefined);
  }

  const jar = await cookies();
  clearSessionCookies(jar);

  return NextResponse.json({ ok: true });
}
