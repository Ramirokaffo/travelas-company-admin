import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LoginStatus, isLoginStatus } from "@/constants/auth-status";
import { isAllowedDashboardRole } from "@/constants/roles";
import { isSuccessfulLogin, login } from "@/features/auth/api";
import { loginSchema } from "@/features/auth/schemas";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "@/i18n/config";
import { ApiError, toUserMessage } from "@/lib/api/errors";
import { setSessionCookies } from "@/lib/auth/cookies";
import { setPendingRegistration } from "@/lib/auth/pending-registration";
import { CsrfError, assertSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { toSessionUser } from "@/types/user";

/**
 * `POST /api/auth/login`
 *
 * Unique point d'entrée de l'authentification. Le navigateur ne parle jamais
 * directement à l'API NestJS : les tokens sont échangés ici et rangés dans des
 * cookies `httpOnly`, hors de portée de JavaScript.
 *
 * Les messages renvoyés sont traduits ici, dans la langue résolue pour la
 * requête : le formulaire les affiche tels quels, sans avoir à connaître la
 * table des statuts métier du backend.
 */
export async function POST(request: Request) {
  const t = await getTranslations("auth");
  const tRoot = await getTranslations();

  try {
    assertSameOrigin(request);

    // Anti-bourrage d'identifiants, en amont du backend.
    const limit = rateLimit(`login:${clientKey(request)}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: t("errors.rateLimited") },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: t("errors.invalidRequest") },
        { status: 400 },
      );
    }

    const response = await login({
      login: parsed.data.login.toLowerCase(),
      password: parsed.data.password,
      ...(parsed.data.newPassword ? { newPassword: parsed.data.newPassword } : {}),
    });

    // Échecs métier : le backend répond 200 avec un `status`.
    if (!isSuccessfulLogin(response)) {
      const status = response.status;

      /**
       * Compte créé mais e-mail jamais vérifié : c'est une **impasse** si on se
       * contente d'afficher le message. L'utilisateur ne peut ni se connecter,
       * ni se réinscrire (son téléphone et son identifiant sont déjà pris), et
       * l'écran de vérification a été quitté depuis longtemps.
       *
       * On rouvre donc le parcours ici : le backend n'accompagne ce statut de
       * l'identité du compte qu'après avoir validé le mot de passe, ce qui rend
       * l'opération sûre — seul le titulaire du compte peut la déclencher.
       * L'identifiant est rangé dans le cookie `httpOnly`, pas dans la réponse.
       */
      const canResumeVerification =
        status === LoginStatus.ACCOUNT_NOT_VERIFIED &&
        Boolean(response.userId) &&
        Boolean(response.email);

      if (canResumeVerification) {
        await setPendingRegistration({
          userId: response.userId as string,
          email: (response.email as string).toLowerCase(),
        });
      }

      return NextResponse.json(
        {
          status,
          message: isLoginStatus(status) ? t(`status.${status}`) : t("errors.failed"),
          ...(canResumeVerification ? { canResumeVerification } : {}),
        },
        { status: status === LoginStatus.NEED_PASSWORD_UPDATE ? 200 : 401 },
      );
    }

    // Cloisonnement des dashboards : ce front n'accepte que les chefs
    // d'entreprise. Un agent ou un chauffeur possède des identifiants valides
    // mais ne doit pas obtenir de session ici.
    if (!isAllowedDashboardRole(response.user.role)) {
      return NextResponse.json(
        { message: t("errors.wrongDashboard") },
        { status: 403 },
      );
    }

    const jar = await cookies();
    setSessionCookies(jar, {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    });

    // Première connexion depuis ce navigateur : la langue du compte (champ
    // `lang` côté backend) sert d'amorce. Un choix déjà fait dans le sélecteur
    // prime — on ne l'écrase jamais.
    if (!jar.get(LOCALE_COOKIE) && isLocale(response.user.lang)) {
      jar.set(LOCALE_COOKIE, response.user.lang, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    // On ne renvoie que la projection publique : jamais l'entité brute
    // (qui contient `password`, `salt`, `firebaseId`…).
    return NextResponse.json({
      status: LoginStatus.SUCCESS,
      user: toSessionUser(response.user),
    });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ message: tRoot(error.message) }, { status: 403 });
    }
    if (error instanceof ApiError) {
      // Le backend lève une 403 pour les comptes bloqués, avec le code métier
      // dans le message.
      const status = error.code;
      const known = isLoginStatus(status);
      return NextResponse.json(
        {
          ...(known ? { status } : {}),
          message: known ? t(`status.${status}`) : toUserMessage(error, tRoot),
        },
        { status: error.status === 403 ? 403 : error.status },
      );
    }
    return NextResponse.json({ message: tRoot("errors.unexpected") }, { status: 500 });
  }
}
