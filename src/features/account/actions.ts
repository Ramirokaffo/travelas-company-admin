"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { EmailTokenStatus } from "@/constants/auth-status";
import { ApiError, toUserMessage } from "@/lib/api/errors";
import { getAuthorizedToken, requireSession } from "@/lib/auth/session";

import {
  cancelEmailChange,
  changeMyPassword,
  confirmEmailChange,
  deleteMyAvatar,
  requestEmailChange,
  updateMyLang,
  updateMyProfile,
  uploadMyAvatar,
} from "./api";
import {
  accountLangSchema,
  changePasswordFormSchema,
  checkAvatarImage,
  emailChangeCodeSchema,
  emailChangeFormSchema,
  profileFormSchema,
} from "./schemas";

/**
 * Server Actions du domaine « compte ».
 *
 * `requireSession()` — et non `requireCompanySession()` : ces réglages sont
 * ceux de la personne, pas de l'entreprise. Ils doivent rester atteignables
 * même si l'onboarding n'est pas terminé (changer un mot de passe compromis ne
 * peut pas dépendre de la création d'une entreprise).
 *
 * Chaque action est un **point d'entrée HTTP indépendant** : le layout ne la
 * protège pas, d'où la garde en première ligne de chacune (règle 4 de
 * CLAUDE.md).
 *
 * Aucun mot de passe n'est journalisé, ici ni ailleurs (règle 9).
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Codes métier renvoyés par le backend dans le corps d'une 400. */
const DUPLICATE_MESSAGES: Record<string, { field: string; message: string }> = {
  "duplicate email": { field: "newEmail", message: "settings.actions.duplicateEmail" },
  "duplicate phone number": {
    field: "phoneNumber",
    message: "settings.actions.duplicatePhone",
  },
  "duplicate username": {
    field: "userName",
    message: "settings.actions.duplicateUsername",
  },
};

/** Extrait le code métier d'une erreur backend, quel que soit son niveau. */
function backendStatus(error: ApiError): string | undefined {
  const details = error.details;
  if (!details || typeof details !== "object") return undefined;

  const direct = (details as { status?: unknown }).status;
  if (typeof direct === "string") return direct;

  const nested = (details as { response?: { status?: unknown } }).response?.status;
  return typeof nested === "string" ? nested : undefined;
}

async function toActionError(error: unknown, fallback: string): Promise<ActionResult> {
  if (error instanceof ApiError) {
    const duplicate = DUPLICATE_MESSAGES[backendStatus(error) ?? ""];
    if (duplicate) {
      return {
        ok: false,
        message: duplicate.message,
        fieldErrors: { [duplicate.field]: duplicate.message },
      };
    }

    if (error.status >= 500) return { ok: false, message: "errors.unavailable" };
    if (error.isForbidden) return { ok: false, message: fallback };

    // Message venu du backend : non traduisible, transmis tel quel.
    return { ok: false, message: toUserMessage(error, await getTranslations()) };
  }

  return { ok: false, message: "errors.unexpected" };
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Revalide l'arbre entier.
 *
 * Le nom et la photo du titulaire sont affichés par la barre supérieure, donc
 * par le layout : une revalidation de la seule page laisserait l'ancienne
 * valeur en place jusqu'au prochain chargement complet.
 */
function revalidateSessionViews() {
  revalidatePath("/", "layout");
}

/* -------------------------------------------------------------------------- */
/* Identité                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = profileFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "settings.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const token = await getAuthorizedToken();
    await updateMyProfile(parsed.data, token);
  } catch (error) {
    return toActionError(error, "settings.actions.profileFailed");
  }

  revalidateSessionViews();
  return { ok: true, message: "settings.actions.profileUpdated" };
}

/* -------------------------------------------------------------------------- */
/* Photo de profil                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Remplace la photo de profil.
 *
 * `FormData` et non un objet : le fichier sort recadré de `<ImageCropper>`, et
 * un `File` ne traverse une Server Action que dans un `FormData`.
 */
export async function updateAvatarAction(formData: FormData): Promise<ActionResult> {
  await requireSession();

  const image = checkAvatarImage(formData.get("image"));
  if (!image.ok) {
    return { ok: false, message: image.message, fieldErrors: { image: image.message } };
  }
  if (!image.file) {
    return { ok: false, message: "settings.actions.imageRequired" };
  }

  try {
    const token = await getAuthorizedToken();
    await uploadMyAvatar(image.file, token);
  } catch (error) {
    return toActionError(error, "settings.actions.avatarFailed");
  }

  revalidateSessionViews();
  return { ok: true, message: "settings.actions.avatarUpdated" };
}

export async function removeAvatarAction(): Promise<ActionResult> {
  await requireSession();

  try {
    const token = await getAuthorizedToken();
    await deleteMyAvatar(token);
  } catch (error) {
    return toActionError(error, "settings.actions.avatarFailed");
  }

  revalidateSessionViews();
  return { ok: true, message: "settings.actions.avatarRemoved" };
}

/* -------------------------------------------------------------------------- */
/* Mot de passe                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Change le mot de passe du compte connecté.
 *
 * La session reste ouverte : le backend ne repositionne pas `isLoggedOut`, et
 * déconnecter l'utilisateur ici l'obligerait à ressaisir un mot de passe qu'il
 * vient de choisir. Les autres sessions du compte, elles, restent valides —
 * c'est une limite connue, notée au chantier A de PLAN.md.
 */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = changePasswordFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "settings.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const token = await getAuthorizedToken();
    await changeMyPassword(
      {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
      token,
    );
  } catch (error) {
    // Le backend répond en 400 « Le mot de passe actuel est incorrect » : on
    // rattache le message au champ concerné plutôt que de le noyer en tête de
    // formulaire.
    if (error instanceof ApiError && error.status === 400) {
      return {
        ok: false,
        message: "settings.actions.passwordFailed",
        fieldErrors: {
          currentPassword: toUserMessage(error, await getTranslations()),
        },
      };
    }
    return toActionError(error, "settings.actions.passwordFailed");
  }

  return { ok: true, message: "settings.actions.passwordUpdated" };
}

/* -------------------------------------------------------------------------- */
/* Adresse e-mail                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Demande le changement d'adresse e-mail.
 *
 * L'adresse actuelle ne bouge pas : le backend range la nouvelle dans
 * `pendingEmail` et lui envoie un code. Le compte reste donc pleinement
 * utilisable pendant la vérification, et une adresse mal saisie se corrige par
 * une nouvelle demande.
 */
export async function requestEmailChangeAction(input: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = emailChangeFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "settings.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const token = await getAuthorizedToken();
    await requestEmailChange(
      {
        currentPassword: parsed.data.currentPassword,
        newEmail: parsed.data.newEmail.toLowerCase(),
      },
      token,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      const duplicate = DUPLICATE_MESSAGES[backendStatus(error) ?? ""];
      if (!duplicate) {
        // Mot de passe erroné, adresse identique à l'actuelle : le message du
        // backend est précis, et il concerne un champ précis.
        return {
          ok: false,
          message: "settings.actions.emailRequestFailed",
          fieldErrors: {
            currentPassword: toUserMessage(error, await getTranslations()),
          },
        };
      }
    }
    return toActionError(error, "settings.actions.emailRequestFailed");
  }

  revalidateSessionViews();
  return { ok: true, message: "settings.actions.emailRequested" };
}

/** Valide le code reçu sur la nouvelle adresse et l'installe. */
export async function confirmEmailChangeAction(input: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = emailChangeCodeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "settings.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const token = await getAuthorizedToken();
    const response = await confirmEmailChange(parsed.data.code, token);

    if (response.status !== EmailTokenStatus.TRUST) {
      const message =
        response.status === EmailTokenStatus.EXPIRED
          ? "settings.actions.codeExpired"
          : response.status === EmailTokenStatus.NO_USER
            ? "settings.actions.noPendingEmail"
            : "settings.actions.codeInvalid";

      return { ok: false, message, fieldErrors: { code: message } };
    }
  } catch (error) {
    return toActionError(error, "settings.actions.emailConfirmFailed");
  }

  revalidateSessionViews();
  return { ok: true, message: "settings.actions.emailChanged" };
}

export async function cancelEmailChangeAction(): Promise<ActionResult> {
  await requireSession();

  try {
    const token = await getAuthorizedToken();
    await cancelEmailChange(token);
  } catch (error) {
    return toActionError(error, "settings.actions.emailCancelFailed");
  }

  revalidateSessionViews();
  return { ok: true, message: "settings.actions.emailCancelled" };
}

/* -------------------------------------------------------------------------- */
/* Préférences                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Enregistre la langue **du compte**.
 *
 * La langue du dashboard, elle, vit dans un cookie écrit par le navigateur
 * (`LocaleSwitcher`) : celle-ci la double sur le compte, pour les e-mails et
 * les notifications envoyés hors de cette interface.
 *
 * Un échec n'est pas bloquant du point de vue de l'utilisateur — l'interface a
 * déjà changé de langue — mais il est signalé plutôt que tu.
 */
export async function updateAccountLangAction(input: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = accountLangSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "settings.actions.invalidFields" };
  }

  try {
    const token = await getAuthorizedToken();
    await updateMyLang(parsed.data.lang, token);
  } catch (error) {
    return toActionError(error, "settings.actions.langFailed");
  }

  return { ok: true, message: "settings.actions.langUpdated" };
}
