/**
 * Rôles utilisateur — miroir strict de `UserRoleEnum` côté backend NestJS
 * (`src/enum/user-role.enum.ts`). Toute divergence casse le contrôle d'accès.
 */
export const UserRole = {
  SUPER_ADMIN: "super_admin",
  COMPANY_ADMIN: "company_admin",
  COMPANY_DRIVER: "company_driver",
  COMPANY_AGENT: "company_agent",
  AGENCY_ADMIN: "agency_admin",
  USER: "user",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Seul rôle autorisé à se connecter à CE dashboard.
 * Vérifié côté serveur après authentification (voir `lib/auth/session.ts`) :
 * le backend accepte plusieurs rôles sur `POST /auth/login`, c'est donc ici
 * que se joue le cloisonnement entre les différents fronts d'administration.
 */
export const ALLOWED_DASHBOARD_ROLES: readonly UserRole[] = [UserRole.COMPANY_ADMIN];

export function isAllowedDashboardRole(role: unknown): role is UserRole {
  return typeof role === "string" && ALLOWED_DASHBOARD_ROLES.includes(role as UserRole);
}

/** Rôles que le chef d'entreprise peut créer depuis ce dashboard. */
export const MANAGEABLE_ROLES: readonly UserRole[] = [
  UserRole.AGENCY_ADMIN,
  UserRole.COMPANY_AGENT,
  UserRole.COMPANY_DRIVER,
];

/**
 * Les libellés de rôle ne vivent plus ici mais dans les catalogues de langue,
 * sous la clé `roles.<role>` : `useTranslations("roles")(role)` côté composant,
 * `getTranslations("roles")` côté serveur. La valeur brute du rôle est déjà la
 * clé, aucune table de correspondance n'est nécessaire.
 */
