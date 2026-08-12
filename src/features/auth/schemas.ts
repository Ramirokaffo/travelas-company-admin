import { z } from "zod";

/**
 * Schémas de validation partagés client/serveur.
 *
 * Le même schéma sert au formulaire (retour immédiat) et au route handler :
 * la validation client est une commodité, celle du serveur est la garantie.
 *
 * Les messages sont des **clés de catalogue**, pas du texte : ce module est
 * importé des deux côtés de la frontière et ne peut pas accéder à un
 * traducteur, qui dépend de la requête. La traduction a lieu à l'affichage,
 * via `useTranslatedMessage()` (voir `lib/i18n/message.ts`).
 */

export const loginSchema = z.object({
  /** E-mail ou nom d'utilisateur — le backend accepte les deux. */
  login: z
    .string()
    .trim()
    .min(1, "validation.loginRequired")
    .max(120, "validation.loginTooLong"),
  password: z
    .string()
    .min(1, "validation.passwordRequired")
    .max(128, "validation.passwordTooLong"),
  /** Requis uniquement lorsque le backend renvoie `need_password_update`. */
  newPassword: z.string().min(8).max(128).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Règles de mot de passe pour toute création/rotation depuis ce dashboard.
 * Les comptes visés (chefs d'entreprise, chefs d'agence) ont accès à des
 * données financières : on impose plus que le minimum.
 */
export const strongPasswordSchema = z
  .string()
  .min(12, "validation.passwordMin12")
  .max(128, "validation.passwordMax128")
  .regex(/[a-z]/, "validation.passwordLowercase")
  .regex(/[A-Z]/, "validation.passwordUppercase")
  .regex(/[0-9]/, "validation.passwordDigit")
  .regex(/[^A-Za-z0-9]/, "validation.passwordSpecial");

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "validation.firstNameRequired")
      .max(50, "validation.max50"),
    lastName: z
      .string()
      .trim()
      .min(2, "validation.lastNameRequired")
      .max(50, "validation.max50"),
    userName: z
      .string()
      .trim()
      .min(3, "validation.usernameMin3")
      .max(30, "validation.max30")
      .regex(/^[a-zA-Z0-9._-]+$/, "validation.usernameCharset"),
    email: z.email("validation.emailInvalid").max(50, "validation.max50"),
    /**
     * Le backend valide ce champ avec `@IsPhoneNumber()` **sans région** :
     * l'indicatif international est donc obligatoire, faute de quoi la requête
     * échoue en 400 sans message exploitable.
     */
    phoneNumber: z
      .string()
      .trim()
      .max(15, "validation.max15")
      .regex(/^\+[1-9]\d{7,13}$/, "validation.phoneInternational"),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "validation.confirmPasswordRequired"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Code de vérification reçu par e-mail.
 *
 * Le backend le génère avec `Math.floor(100000 + Math.random() * 9000)` : six
 * chiffres, valables cinq minutes. On accepte une plage un peu plus large pour
 * ne pas dépendre de cette formule, l'exactitude étant vérifiée par le backend.
 */
export const emailCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "validation.codeInvalid"),
});

export type EmailCodeInput = z.infer<typeof emailCodeSchema>;

/**
 * Correction de l'adresse d'une inscription pas encore vérifiée.
 *
 * Sans elle, une faute de frappe dans l'e-mail est sans issue : le compte
 * existe déjà, donc se réinscrire échoue sur le doublon de téléphone ou
 * d'identifiant, et le code part vers une adresse hors de portée.
 */
export const changeEmailSchema = z.object({
  email: z.email("validation.emailInvalid").max(50, "validation.max50"),
});

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

/**
 * Demande de réinitialisation : une adresse, rien de plus.
 *
 * La réponse ne dira jamais si le compte existe — la distinguer permettrait
 * d'énumérer les comptes, comme sur le formulaire de connexion.
 */
export const forgotPasswordSchema = z.object({
  email: z.email("validation.emailInvalid").max(50, "validation.max50"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Nouveau mot de passe, soumis avec le jeton de réinitialisation. */
export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "validation.confirmPasswordRequired"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Règles de mot de passe présentées à l'inscription.
 *
 * Elles doublent `strongPasswordSchema` sous une forme énumérable : le
 * formulaire affiche une liste de contrôle qui se coche à la frappe, plutôt
 * qu'un message d'erreur unique découvert à la validation.
 */
export const PASSWORD_RULES = [
  { key: "length", test: (value: string) => value.length >= 12 },
  { key: "lowercase", test: (value: string) => /[a-z]/.test(value) },
  { key: "uppercase", test: (value: string) => /[A-Z]/.test(value) },
  { key: "digit", test: (value: string) => /[0-9]/.test(value) },
  { key: "special", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export type PasswordRuleKey = (typeof PASSWORD_RULES)[number]["key"];
