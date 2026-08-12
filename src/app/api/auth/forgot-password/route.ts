import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { requestPasswordResetCode } from "@/features/auth/api";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import { setPasswordReset } from "@/lib/auth/password-reset";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

/**
 * `POST /api/auth/forgot-password`
 *
 * Première étape : envoi d'un code à six chiffres à l'adresse du compte.
 *
 * **La réponse est la même que le compte existe ou non.** Le backend, lui, lève
 * une 400 pour une adresse inconnue : la relayer permettrait d'énumérer les
 * comptes du dashboard, exactement ce que le formulaire de connexion évite déjà
 * en donnant le même message pour « mot de passe erroné » et « compte
 * inexistant ». Le cookie d'étape est posé dans les deux cas, sans quoi son
 * absence trahirait la même information.
 */
export async function POST(request: Request) {
  const t = await getTranslations("auth.forgotPassword");
  const tRoot = await getTranslations();

  try {
    assertSameOrigin(request);

    // Chaque appel envoie un e-mail : le quota est aligné sur celui que le
    // backend applique désormais à `/auth/sendConfirmationEmail`.
    const limit = rateLimit(`forgot-password:${clientKey(request)}`, {
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: t("errors.rateLimited") },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const parsed = forgotPasswordSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { message: tRoot("validation.emailInvalid") },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();

    try {
      await requestPasswordResetCode(email);
    } catch (error) {
      // Compte inconnu : on n'en dit rien. Une panne réelle (5xx) reste
      // signalée — la taire ferait attendre un e-mail qui n'arrivera pas.
      if (!(error instanceof ApiError) || error.status >= 500) throw error;
    }

    await setPasswordReset({ email });

    return NextResponse.json({ email });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ message: tRoot(error.message) }, { status: 403 });
    }
    return NextResponse.json({ message: tRoot("errors.unavailable") }, { status: 502 });
  }
}
