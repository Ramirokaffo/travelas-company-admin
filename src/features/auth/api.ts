import "server-only";

import { z } from "zod";

import { LoginStatus } from "@/constants/auth-status";
import { ApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/server-api";
import { userSchema } from "@/types/user";

/**
 * Contrat de `POST /auth/login` côté NestJS.
 *
 * Particularité du backend : un échec « métier » (mot de passe erroné, compte
 * non vérifié…) renvoie un **200** avec un champ `status`, tandis qu'un compte
 * bloqué lève une 403. Le front doit donc traiter les deux chemins.
 */
export const loginResponseSchema = z
  .object({
    status: z.string(),
    user: userSchema.optional(),
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    /**
     * Renseignés par le backend **uniquement** avec `account_not_verified`, et
     * seulement après validation du mot de passe. Ils permettent de reprendre
     * la vérification d'e-mail sans redemander toute l'inscription.
     */
    userId: z.string().optional(),
    email: z.string().optional(),
  })
  .loose();

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export function login(input: {
  login: string;
  password: string;
  newPassword?: string;
}): Promise<LoginResponse> {
  return apiFetch("/auth/login", loginResponseSchema, {
    method: "POST",
    body: input,
  });
}

/** Vrai si la réponse contient une session exploitable. */
export function isSuccessfulLogin(
  response: LoginResponse,
): response is LoginResponse & {
  user: NonNullable<LoginResponse["user"]>;
  access_token: string;
  refresh_token: string;
} {
  return (
    response.status === LoginStatus.SUCCESS &&
    Boolean(response.user) &&
    Boolean(response.access_token) &&
    Boolean(response.refresh_token)
  );
}

/** Invalide la session côté backend (`isLoggedOut = true`). */
export function logout(accessToken: string): Promise<unknown> {
  return apiFetch("/auth/logOut", z.unknown(), { accessToken });
}

/**
 * Contrat de `POST /auth/create`.
 *
 * Le backend renvoie l'**entité TypeORM complète** du nouveau compte — hash de
 * mot de passe et sel compris. Le schéma de `user` est donc volontairement
 * fermé (pas de `.loose()`) : Zod ne conserve que les deux champs déclarés et
 * jette tout le reste, ici même, avant que la donnée ne circule dans
 * l'application. C'est la règle 7 de CLAUDE.md appliquée au plus tôt.
 */
const createdUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
});

export const registerResponseSchema = z.object({
  status: z.string(),
  user: createdUserSchema.optional(),
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

/** Corps accepté par `UserSubscribeDto`. */
export type RegisterPayload = {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  phoneNumber: string;
  password: string;
  lang: string;
};

/**
 * Crée le compte du chef d'entreprise.
 *
 * `auth.service.create()` force `role = company_admin` : aucun champ de rôle ne
 * transite, et il ne faut surtout pas en ajouter — `UserSubscribeDto` est
 * soumis à `forbidNonWhitelisted`, un champ en trop ferait échouer la requête
 * en 400.
 */
export function register(input: RegisterPayload): Promise<RegisterResponse> {
  return apiFetch("/auth/create", registerResponseSchema, {
    method: "POST",
    body: input,
  });
}

/** Réponse des endpoints qui ne renvoient qu'un statut métier. */
const statusResponseSchema = z.object({ status: z.string() }).loose();

/**
 * Valide le code reçu par e-mail (`POST /auth/email`).
 *
 * Le handler backend lit `token` et `userId` à même le corps, sans DTO. La
 * réponse porte un `AuthStatusEnum` : `"Yes"` en cas de succès.
 */
export function confirmEmailToken(input: {
  token: string;
  userId: string;
}): Promise<{ status: string }> {
  return apiFetch("/auth/email", statusResponseSchema, {
    method: "POST",
    body: input,
  });
}

/**
 * Renvoie un code de vérification (`POST /auth/sendConfirmationEmail`).
 *
 * Le code précédent est supprimé côté backend : seul le dernier envoyé est
 * valable. Un compte déjà vérifié renvoie `already_activate`, un e-mail inconnu
 * une 400.
 */
export function requestConfirmationEmail(email: string): Promise<{ status: string }> {
  return apiFetch("/auth/sendConfirmationEmail", statusResponseSchema, {
    method: "POST",
    body: { email },
  });
}

/**
 * Corrige l'adresse d'un compte dont l'e-mail n'est pas encore vérifié
 * (`POST /auth/updateUnverifyEmail`), et déclenche un nouvel envoi.
 *
 * `userId` est exigé par le backend depuis le chantier H : la route est ouverte
 * (`@SkipAuth()`), et seul cet UUID prouve que l'appelant est bien à l'origine
 * de l'inscription. Il vient du cookie `httpOnly`, jamais du navigateur.
 *
 * Le backend refuse par ailleurs l'opération dès que l'adresse est vérifiée :
 * elle ne peut donc pas servir à détourner un compte actif.
 */
export function updateUnverifiedEmail(input: {
  userId: string;
  oldEmail: string;
  newEmail: string;
}): Promise<{ status: string }> {
  return apiFetch("/auth/updateUnverifyEmail", statusResponseSchema, {
    method: "POST",
    body: input,
  });
}

/**
 * Demande un code de réinitialisation de mot de passe.
 *
 * C'est le même endpoint que la vérification d'inscription, avec `reauth=true` :
 * ce drapeau est ce qui autorise l'envoi à un compte **déjà vérifié**, et c'est
 * lui qui fera délivrer un `reset_token` à la validation du code.
 */
export function requestPasswordResetCode(email: string): Promise<{ status: string }> {
  return apiFetch("/auth/sendConfirmationEmail", statusResponseSchema, {
    method: "POST",
    query: { reauth: true },
    body: { email },
  });
}

const resetTokenResponseSchema = z
  .object({ status: z.string(), reset_token: z.string().optional() })
  .loose();

/**
 * Valide le code de réinitialisation et récupère le jeton associé.
 *
 * En mode `reauth`, le backend cherche le code **sans identifiant de compte** :
 * il n'accepte donc que `token`. Le `reset_token` renvoyé est un JWT de 30
 * minutes qui autorise à lui seul le changement de mot de passe — il ne quitte
 * jamais le serveur (voir `lib/auth/password-reset.ts`).
 */
export function verifyPasswordResetCode(
  code: string,
): Promise<z.infer<typeof resetTokenResponseSchema>> {
  return apiFetch("/auth/email", resetTokenResponseSchema, {
    method: "POST",
    query: { reauth: true },
    body: { token: code },
  });
}

/**
 * Change le mot de passe avec le jeton de réinitialisation
 * (`POST /auth/resetPassword`, `Authorization: Bearer <reset_token>`).
 *
 * Le backend refuse un mot de passe identique au précédent.
 */
export function resetPassword(
  newPassword: string,
  resetToken: string,
): Promise<{ status: string }> {
  return apiFetch("/auth/resetPassword", statusResponseSchema, {
    method: "POST",
    accessToken: resetToken,
    body: { newPassword },
  });
}

/**
 * Extrait le code métier d'un échec de `POST /auth/create`.
 *
 * Le service lève `BadRequestException({ status })` puis **ré-emballe** l'objet
 * dans un second `BadRequestException` depuis son `catch`. Le corps HTTP a donc
 * la forme `{ response: { status }, status: 400, … }`, et le code recherché se
 * trouve un niveau plus bas que pour `POST /user/create`. On regarde les deux
 * emplacements plutôt que de parier sur l'un d'eux.
 */
const nestedStatusSchema = z.object({
  response: z.object({ status: z.string() }).loose(),
});

export function registerFailureStatus(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;

  const direct = statusResponseSchema.safeParse(error.details);
  if (direct.success) return direct.data.status;

  const nested = nestedStatusSchema.safeParse(error.details);
  return nested.success ? nested.data.response.status : undefined;
}
