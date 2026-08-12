import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { requestConfirmationEmail } from "@/features/auth/api";
import { ApiError } from "@/lib/api/errors";
import { readPendingRegistration } from "@/lib/auth/pending-registration";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

/**
 * `POST /api/auth/resend-verification`
 *
 * Renvoie un code de vérification à l'adresse de l'inscription en cours.
 *
 * L'adresse est lue dans le cookie `httpOnly`, jamais dans le corps de la
 * requête : ce point d'entrée ne peut donc pas servir à envoyer des e-mails à
 * une adresse arbitraire. Le quota est plus strict que celui de l'inscription —
 * chaque appel déclenche un envoi.
 */
export async function POST(request: Request) {
  const t = await getTranslations("auth.verify");
  const tRoot = await getTranslations();

  try {
    assertSameOrigin(request);

    const limit = rateLimit(`resend-verification:${clientKey(request)}`, {
      limit: 3,
      windowMs: 10 * 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: t("errors.rateLimited") },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const pending = await readPendingRegistration();
    if (!pending) {
      return NextResponse.json({ message: t("errors.noPending") }, { status: 409 });
    }

    const response = await requestConfirmationEmail(pending.email);

    // Le compte est déjà vérifié : le backend n'enverra aucun code. On le dit,
    // plutôt que de laisser attendre un e-mail qui ne viendra pas.
    if (response.status === "already_activate") {
      return NextResponse.json(
        { status: "already_verified", message: t("verifiedNotice") },
        { status: 409 },
      );
    }

    return NextResponse.json({ email: pending.email });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ message: tRoot(error.message) }, { status: 403 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: t("errors.resendFailed") },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    return NextResponse.json({ message: tRoot("errors.unexpected") }, { status: 500 });
  }
}
