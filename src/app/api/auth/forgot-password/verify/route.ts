import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { EmailTokenStatus } from "@/constants/auth-status";
import { verifyPasswordResetCode } from "@/features/auth/api";
import { emailCodeSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import { readPasswordReset, setPasswordReset } from "@/lib/auth/password-reset";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

/**
 * `POST /api/auth/forgot-password/verify`
 *
 * Deuxième étape : validation du code, et récupération du jeton de
 * réinitialisation.
 *
 * Le `reset_token` renvoyé par le backend autorise à lui seul le changement du
 * mot de passe. Il est rangé dans le cookie `httpOnly` de l'étape — il ne
 * traverse jamais la réponse HTTP, et le formulaire n'a donc rien à en savoir.
 */
export async function POST(request: Request) {
  const t = await getTranslations("auth.forgotPassword");
  const tRoot = await getTranslations();

  try {
    assertSameOrigin(request);

    // En mode `reauth`, le backend cherche le code sans identifiant de compte :
    // une force brute réussie donnerait un jeton de réinitialisation sur le
    // compte propriétaire du code. D'où un quota strict, en plus des 900 000
    // valeurs et des 5 minutes de validité côté backend.
    const limit = rateLimit(`forgot-password-verify:${clientKey(request)}`, {
      limit: 8,
      windowMs: 10 * 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: t("errors.rateLimited") },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const pending = await readPasswordReset();
    if (!pending) {
      return NextResponse.json({ message: t("errors.noPending") }, { status: 409 });
    }

    const parsed = emailCodeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: t("errors.invalidCode") }, { status: 400 });
    }

    const response = await verifyPasswordResetCode(parsed.data.code);

    if (response.status !== EmailTokenStatus.TRUST || !response.reset_token) {
      return NextResponse.json(
        {
          message:
            response.status === EmailTokenStatus.EXPIRED
              ? t("errors.expiredCode")
              : t("errors.invalidCode"),
        },
        { status: 400 },
      );
    }

    await setPasswordReset({ email: pending.email, resetToken: response.reset_token });

    return NextResponse.json({ email: pending.email });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ message: tRoot(error.message) }, { status: 403 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          message:
            error.status >= 500 ? tRoot("errors.unavailable") : t("errors.invalidCode"),
        },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    return NextResponse.json({ message: tRoot("errors.unexpected") }, { status: 500 });
  }
}
