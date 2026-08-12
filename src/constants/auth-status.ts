/**
 * Statuts de connexion — miroir de `UserLoginStatusEnum` côté backend
 * (`src/enum/user.enum.ts`).
 */
export const LoginStatus = {
  SUCCESS: "login_successfully",
  WRONG_PASSWORD: "wrong_password",
  ACCOUNT_NOT_VERIFIED: "account_not_verified",
  NEED_PASSWORD_UPDATE: "need_password_update",
  ACCOUNT_DOESNT_EXIST: "account_doesnt_exist",
  ACCOUNT_BLOCKED: "account_blocked",
  ACCOUNT_BLOCKED_BY_COMPANY: "account_blocked_by_company",
} as const;

export type LoginStatus = (typeof LoginStatus)[keyof typeof LoginStatus];

export function isLoginStatus(value: unknown): value is LoginStatus {
  return (
    typeof value === "string" &&
    (Object.values(LoginStatus) as string[]).includes(value)
  );
}

/**
 * Les messages affichés vivent dans les catalogues de langue, sous
 * `auth.status.<statut>` — la valeur du statut est directement la clé.
 *
 * Deux d'entre eux sont volontairement identiques : « compte inexistant » et
 * « mot de passe erroné » renvoient le même texte, car les distinguer
 * permettrait d'énumérer les comptes valides.
 */

/**
 * Statuts de `POST /auth/create` — miroir de `userAccountCreateStatus`
 * (`src/enum/user-account-create-status.enum.ts`).
 *
 * Les valeurs comportent des espaces et `CREATED` vaut `"yes"` : ce sont bien
 * les chaînes du backend, pas une convention de ce dépôt. Elles arrivent dans
 * le **corps** d'une 400 (`BadRequestException({ status })`), pas dans
 * `message`.
 */
export const RegisterStatus = {
  CREATED: "yes",
  DUPLICATE_EMAIL: "duplicate email",
  DUPLICATE_PHONE: "duplicate phone number",
  DUPLICATE_USERNAME: "duplicate username",
} as const;

export type RegisterStatus = (typeof RegisterStatus)[keyof typeof RegisterStatus];

/**
 * Statuts de vérification du jeton e-mail — miroir de `AuthStatusEnum`.
 * `TRUST` est le seul cas de succès ; `EXPIRED` survient au-delà de 5 minutes.
 */
export const EmailTokenStatus = {
  TRUST: "Yes",
  EXPIRED: "TimeOut",
  FAKE: "No",
  NO_USER: "None",
} as const;

export type EmailTokenStatus = (typeof EmailTokenStatus)[keyof typeof EmailTokenStatus];
