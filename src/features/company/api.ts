import "server-only";

import { apiFetch } from "@/lib/api/server-api";
import { companySchema, type Company } from "@/types/user";

import {
  toCompanyProfile,
  type CompanyProfile,
  type CompanySettingsValues,
} from "./schemas";

/**
 * Accès backend du domaine « entreprise » — SERVEUR UNIQUEMENT.
 *
 * `POST /company` attend du **multipart** : le contrôleur monte un
 * `FileFieldsInterceptor` sur `logo` et `banner`. Le corps est donc un
 * `FormData` relayé par `apiRequest`, et non du JSON — les noms de champs
 * doivent correspondre exactement, un `logoFile` serait ignoré en silence.
 *
 * `companyId` n'est jamais transmis : le service rattache l'entreprise à
 * l'appelant (`user.company = company`) et refuse une seconde création.
 */
export async function createCompany(
  input: { name: string; logo: File | null; banner: File | null },
  accessToken: string,
): Promise<Company> {
  const formData = new FormData();
  formData.append("name", input.name);
  if (input.logo) formData.append("logo", input.logo);
  if (input.banner) formData.append("banner", input.banner);

  return apiFetch("/company", companySchema, {
    method: "POST",
    accessToken,
    formData,
  });
}

/**
 * Fiche de l'entreprise.
 *
 * `GET /company/:companyId` n'est pas cadré côté backend — n'importe quel
 * compte authentifié peut lire n'importe quelle entreprise. Ce n'est pas une
 * faille en soi (une entreprise de transport est une entité publique, exposée
 * à l'application voyageur), mais cela impose une règle ici : **l'identifiant
 * ne vient jamais de l'URL**, toujours de `session.company.id`.
 */
export async function getCompanyProfile(
  companyId: string,
  accessToken: string,
): Promise<CompanyProfile> {
  const company = await apiFetch(
    `/company/${encodeURIComponent(companyId)}`,
    companySchema,
    { accessToken },
  );

  return toCompanyProfile(company);
}

/**
 * Met à jour la fiche et les réglages.
 *
 * `PATCH /company/:id` monte le même `FileFieldsInterceptor` que la création :
 * le corps est du **multipart**, pas du JSON. Conséquence sur les booléens —
 * `UpdateCompanyDto` les valide en `@IsBooleanString()`, il faut donc écrire
 * `"true"` / `"false"` et non `true` / `false`. Un booléen JavaScript posé dans
 * un `FormData` deviendrait la chaîne `"true"` par coïncidence, mais un `false`
 * deviendrait `"false"` seulement parce que `String(false)` le veut bien : on
 * l'écrit explicitement plutôt que de dépendre de cette coïncidence.
 *
 * Les images ne sont transmises que si elles ont été changées : un champ absent
 * laisse la valeur en place, alors qu'un champ vide effacerait le logo.
 */
export async function updateCompany(
  companyId: string,
  values: CompanySettingsValues,
  images: { logo: File | null; banner: File | null },
  accessToken: string,
): Promise<CompanyProfile> {
  const formData = new FormData();
  formData.append("name", values.name);
  formData.append("allowedAction", values.allowedAction);
  formData.append("allowSeatNumberBook", String(values.allowSeatNumberBook));
  formData.append("allowIssuesReport", String(values.allowIssuesReport));
  formData.append("is2fAuthEnable", String(values.is2fAuthEnable));
  if (images.logo) formData.append("logo", images.logo);
  if (images.banner) formData.append("banner", images.banner);

  const company = await apiFetch(
    `/company/${encodeURIComponent(companyId)}`,
    companySchema,
    { method: "PATCH", accessToken, formData },
  );

  return toCompanyProfile(company);
}
