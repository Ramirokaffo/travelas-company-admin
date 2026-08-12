import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { EmailTokenStatus } from "@/constants/auth-status";
import { confirmEmailToken } from "@/features/auth/api";
import { emailCodeSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import {
  clearPendingRegistration,
  readPendingRegistration,
} from "@/lib/auth/pending-registration";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

/**
 * `POST /api/auth/verify-email`
 *
 * Valide le code à six chiffres reçu par e-mail. Le compte visé n'est pas dans
 * le corps de la requête mais dans le cookie d'inscription en attente : on ne
 * peut donc pas viser le compte d'un tiers en changeant un identifiant.
 *
 * Le quota est serré à dessein. Le backend tire le code dans un intervalle
 * étroit (`100000 + random * 9000`, soit 9 000 valeurs) : sans limitation, il
 * serait devinable en quelques minutes. Voir le chantier H de PLAN.md pour la
 * correction côté backend.
 */
export async function POST(request: Request) {
  const t = await getTranslations("auth.verify");
  const tRoot = await getTranslations();

  try {
    assertSameOrigin(request);

    const limit = rateLimit(`verify-email:${clientKey(request)}`, {
      limit: 10,
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

    const parsed = emailCodeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: t("errors.invalid") }, { status: 400 });
    }

    const response = await confirmEmailToken({
      token: parsed.data.code,
      userId: pending.userId,
    });

    if (response.status !== EmailTokenStatus.TRUST) {
      return NextResponse.json(
        {
          message:
            response.status === EmailTokenStatus.EXPIRED
              ? t("errors.expired")
              : t("errors.invalid"),
        },
        { status: 400 },
      );
    }

    // Vérification acquise : le cookie d'attente n'a plus d'objet.
    await clearPendingRegistration();

    return NextResponse.json({ email: pending.email });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ message: tRoot(error.message) }, { status: 403 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          message:
            error.status >= 500 ? tRoot("errors.unavailable") : t("errors.invalid"),
        },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    return NextResponse.json({ message: tRoot("errors.unexpected") }, { status: 500 });
  }
}
