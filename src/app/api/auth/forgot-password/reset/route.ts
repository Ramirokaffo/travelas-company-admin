import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { resetPassword } from "@/features/auth/api";
import { resetPasswordSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import { clearPasswordReset, readPasswordReset } from "@/lib/auth/password-reset";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

/**
 * `POST /api/auth/forgot-password/reset`
 *
 * Dernière étape : le nouveau mot de passe.
 *
 * Le jeton de réinitialisation vient du cookie `httpOnly` posé à l'étape
 * précédente : le navigateur n'a jamais eu à le manipuler, donc rien à en
 * perdre. Le cookie est effacé dès l'opération réussie — un jeton encore
 * valable 30 minutes n'a plus aucune raison de traîner.
 *
 * Aucune session n'est ouverte ici : après une réinitialisation, se
 * reconnecter est la règle, et cela évite de garder le nouveau mot de passe en
 * mémoire côté navigateur.
 */
export async function POST(request: Request) {
  const t = await getTranslations("auth.forgotPassword");
  const tRoot = await getTranslations();

  try {
    assertSameOrigin(request);

    const limit = rateLimit(`forgot-password-reset:${clientKey(request)}`, {
      limit: 5,
      windowMs: 10 * 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: t("errors.rateLimited") },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const pending = await readPasswordReset();
    if (!pending?.resetToken) {
      return NextResponse.json({ message: t("errors.noPending") }, { status: 409 });
    }

    const parsed = resetPasswordSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ message: t("errors.weakPassword") }, { status: 400 });
    }

    await resetPassword(parsed.data.password, pending.resetToken);
    await clearPasswordReset();

    return NextResponse.json({ email: pending.email });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ message: tRoot(error.message) }, { status: 403 });
    }

    if (error instanceof ApiError) {
      // Le backend refuse un mot de passe identique au précédent.
      if (error.message.includes("New password must be different")) {
        return NextResponse.json(
          { message: t("errors.samePassword") },
          { status: 400 },
        );
      }

      // 401 : jeton expiré ou compte devenu inaccessible entre-temps. Le
      // parcours doit repartir de la demande de code.
      if (error.isUnauthorized || error.isForbidden) {
        await clearPasswordReset();
        return NextResponse.json(
          { message: t("errors.expiredSession") },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          message:
            error.status >= 500 ? tRoot("errors.unavailable") : t("errors.failed"),
        },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }

    return NextResponse.json({ message: tRoot("errors.unexpected") }, { status: 500 });
  }
}
