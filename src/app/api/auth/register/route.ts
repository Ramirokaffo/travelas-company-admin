import { getLocale, getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { RegisterStatus } from "@/constants/auth-status";
import { register, registerFailureStatus } from "@/features/auth/api";
import { registerSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import { setPendingRegistration } from "@/lib/auth/pending-registration";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

/**
 * `POST /api/auth/register`
 *
 * Création du compte du chef d'entreprise. Comme la connexion, c'est un route
 * handler et non une Server Action : il faut poser un cookie et limiter le
 * débit **avant** qu'une session existe.
 *
 * Le mot de passe traverse ce handler et s'arrête ici : il part vers le backend
 * et n'est ni journalisé ni renvoyé. Aucun jeton n'est posé — le compte reste
 * inutilisable tant que l'e-mail n'est pas vérifié (`auth.service.login()`
 * exige `isEmailVerify || isPhoneVerify`).
 */

/** Champ de formulaire à blâmer pour chaque doublon signalé par le backend. */
const DUPLICATE_FIELDS: Record<string, { field: string; key: string }> = {
  [RegisterStatus.DUPLICATE_EMAIL]: { field: "email", key: "duplicateEmail" },
  [RegisterStatus.DUPLICATE_PHONE]: { field: "phoneNumber", key: "duplicatePhone" },
  [RegisterStatus.DUPLICATE_USERNAME]: {
    field: "userName",
    key: "duplicateUsername",
  },
};

export async function POST(request: Request) {
  const t = await getTranslations("auth.register");
  const tRoot = await getTranslations();

  try {
    assertSameOrigin(request);

    // Le backend n'a pas de quota propre sur `/auth/create` : une création de
    // compte déclenche un envoi d'e-mail, donc un coût réel par requête.
    const limit = rateLimit(`register:${clientKey(request)}`, {
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: t("errors.rateLimited") },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const parsed = registerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      // La validation client a déjà eu lieu : arriver ici signale un appel
      // direct, à qui l'on ne doit aucun détail.
      return NextResponse.json(
        { message: t("errors.invalidRequest") },
        { status: 400 },
      );
    }

    const { confirmPassword: _confirmPassword, ...values } = parsed.data;

    const response = await register({
      ...values,
      email: values.email.toLowerCase(),
      userName: values.userName.toLowerCase(),
      // La langue de l'interface amorce celle du compte : les e-mails du
      // backend (`UserLangEnum`) partiront dans la même langue.
      lang: await getLocale(),
    });

    if (response.status !== RegisterStatus.CREATED || !response.user) {
      return NextResponse.json({ message: t("errors.failed") }, { status: 400 });
    }

    // L'identifiant du compte reste côté serveur : l'écran de vérification
    // n'envoie que le code, jamais l'identité de sa cible.
    await setPendingRegistration({
      userId: response.user.id,
      email: values.email.toLowerCase(),
    });

    return NextResponse.json({ email: values.email.toLowerCase() }, { status: 201 });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ message: tRoot(error.message) }, { status: 403 });
    }

    if (error instanceof ApiError) {
      const duplicate = DUPLICATE_FIELDS[registerFailureStatus(error) ?? ""];
      if (duplicate) {
        const message = t(`errors.${duplicate.key}`);
        return NextResponse.json(
          { message, fieldErrors: { [duplicate.field]: message } },
          { status: 409 },
        );
      }

      // `@IsPhoneNumber()` analyse réellement le numéro : un format plausible
      // mais inexistant passe notre schéma et échoue côté DTO. On rend la
      // main au bon champ plutôt que d'afficher un échec global.
      if (error.status === 400 && error.message.includes("phoneNumber")) {
        const message = tRoot("validation.phoneInternational");
        return NextResponse.json(
          { message, fieldErrors: { phoneNumber: message } },
          { status: 400 },
        );
      }

      // Les autres messages du backend sont techniques (« Bad Request
      // Exception ») : ils n'apprennent rien à l'utilisateur.
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
