"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/api/errors";
import {
  getAuthorizedToken,
  requireCompanySession,
  requireSession,
} from "@/lib/auth/session";

import { createCompany, updateCompany } from "./api";
import { checkCompanyImage, companyFormSchema, companySettingsSchema } from "./schemas";

/**
 * Server Actions du domaine « entreprise ».
 *
 * `requireSession()` — et non `requireCompanySession()` : c'est précisément
 * l'action qui crée l'entreprise manquante. Comme toute Server Action, elle est
 * un point d'entrée HTTP indépendant : le layout de la page ne la protège pas.
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function createCompanyAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  // Le backend refuse une seconde entreprise (401 « Already have company ») et
  // orphelinerait la première s'il l'acceptait. On n'appelle même pas.
  if (session.company) redirect(ROUTES.dashboard);

  const parsed = companyFormSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      ok: false,
      message: "onboarding.actions.invalidFields",
      fieldErrors: {
        name: parsed.error.issues[0]?.message ?? "validation.companyNameRequired",
      },
    };
  }

  const logo = checkCompanyImage(formData.get("logo"));
  if (!logo.ok) {
    return { ok: false, message: logo.message, fieldErrors: { logo: logo.message } };
  }

  const banner = checkCompanyImage(formData.get("banner"));
  if (!banner.ok) {
    return {
      ok: false,
      message: banner.message,
      fieldErrors: { banner: banner.message },
    };
  }

  try {
    const token = await getAuthorizedToken();
    await createCompany(
      { name: parsed.data.name, logo: logo.file, banner: banner.file },
      token,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      // Le nom d'entreprise est unique en base : c'est le cas d'échec le plus
      // probable, et il se corrige dans le champ.
      if (error.message.includes("Company already exist")) {
        return {
          ok: false,
          message: "onboarding.actions.duplicateName",
          fieldErrors: { name: "onboarding.actions.duplicateName" },
        };
      }

      // Une entreprise a été créée entre-temps (double soumission, second
      // onglet) : le parcours est terminé, on ne signale pas d'erreur.
      if (error.message.includes("Already have company")) {
        redirect(ROUTES.dashboard);
      }

      if (error.status >= 500) {
        return { ok: false, message: "errors.unavailable" };
      }

      return { ok: false, message: "onboarding.actions.failed" };
    }

    throw error;
  }

  // La session porte l'entreprise : toutes les pages protégées doivent être
  // recalculées, `requireCompanySession()` ne redirigeant plus vers l'onboarding.
  revalidatePath("/", "layout");

  return { ok: true, message: "onboarding.actions.created" };
}

/**
 * Met à jour la fiche et les réglages de l'entreprise.
 *
 * `requireCompanySession()` ici — contrairement à la création, l'entreprise
 * doit exister. L'identifiant vient de la **session**, jamais du formulaire :
 * `PATCH /company/:id` est bien cadré par `assertSameCompany()` côté backend,
 * mais laisser un client choisir la cible ferait dépendre le cloisonnement
 * d'une seule barrière au lieu de deux.
 */
export async function updateCompanyAction(formData: FormData): Promise<ActionResult> {
  const session = await requireCompanySession();

  const parsed = companySettingsSchema.safeParse({
    name: formData.get("name"),
    allowedAction: formData.get("allowedAction"),
    // Une case décochée n'est pas postée : son absence vaut `false`.
    allowSeatNumberBook: formData.get("allowSeatNumberBook") === "on",
    allowIssuesReport: formData.get("allowIssuesReport") === "on",
    is2fAuthEnable: formData.get("is2fAuthEnable") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { ok: false, message: "company.actions.invalidFields", fieldErrors };
  }

  const logo = checkCompanyImage(formData.get("logo"));
  if (!logo.ok) {
    return { ok: false, message: logo.message, fieldErrors: { logo: logo.message } };
  }

  const banner = checkCompanyImage(formData.get("banner"));
  if (!banner.ok) {
    return {
      ok: false,
      message: banner.message,
      fieldErrors: { banner: banner.message },
    };
  }

  try {
    const token = await getAuthorizedToken();
    await updateCompany(
      session.company.id,
      parsed.data,
      { logo: logo.file, banner: banner.file },
      token,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.message.includes("Company already exist")) {
        return {
          ok: false,
          message: "company.actions.duplicateName",
          fieldErrors: { name: "company.actions.duplicateName" },
        };
      }
      if (error.isForbidden) return { ok: false, message: "company.actions.forbidden" };
      if (error.status >= 500) return { ok: false, message: "errors.unavailable" };

      return { ok: false, message: "company.actions.failed" };
    }

    throw error;
  }

  // Le nom et le logo de l'entreprise sont affichés par le layout : la
  // revalidation porte donc sur l'arbre entier, pas sur la seule page.
  revalidatePath("/", "layout");

  return { ok: true, message: "company.actions.updated" };
}
