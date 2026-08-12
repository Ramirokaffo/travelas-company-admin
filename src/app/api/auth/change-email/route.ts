import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { RegisterStatus } from "@/constants/auth-status";
import { registerFailureStatus, updateUnverifiedEmail } from "@/features/auth/api";
import { changeEmailSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import {
  readPendingRegistration,
  setPendingRegistration,
} from "@/lib/auth/pending-registration";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

/**
 * `POST /api/auth/change-email`
 *
 * Corrige l'adresse d'une inscription encore non vérifiée, puis relance l'envoi
 * du code (le backend s'en charge dans la foulée).
 *
 * L'ancienne adresse vient du cookie `httpOnly`, jamais du corps de la requête.
 * C'est essentiel ici : `POST /auth/updateUnverifyEmail` est ouvert
 * (`@SkipAuth()`) et se contente des deux adresses, donc n'importe qui pourrait
 * détourner l'adresse d'une inscription en cours. Depuis ce dashboard, on ne
 * peut modifier que sa propre inscription (chantier H de PLAN.md côté backend).
 */
export async function POST(request: Request) {
  const t = await getTranslations("auth.verify");
  const tRoot = await getTranslations();

  try {
    assertSameOrigin(request);

    const limit = rateLimit(`change-email:${clientKey(request)}`, {
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

    const parsed = changeEmailSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: tRoot("validation.emailInvalid") },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();

    await updateUnverifiedEmail({
      userId: pending.userId,
      oldEmail: pending.email,
      newEmail: email,
    });
    await setPendingRegistration({ userId: pending.userId, email });

    return NextResponse.json({ email });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ message: tRoot(error.message) }, { status: 403 });
    }
    if (error instanceof ApiError) {
      // Depuis le chantier H, le backend vérifie que la nouvelle adresse est
      // libre et signale le doublon avec le même code que l'inscription.
      if (registerFailureStatus(error) === RegisterStatus.DUPLICATE_EMAIL) {
        const message = (await getTranslations("auth.register"))(
          "errors.duplicateEmail",
        );
        return NextResponse.json({ message }, { status: 409 });
      }

      return NextResponse.json(
        { message: t("errors.changeEmailFailed") },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    return NextResponse.json({ message: tRoot("errors.unexpected") }, { status: 500 });
  }
}
