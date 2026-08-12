import "server-only";

import { z } from "zod";

import { paginatedSchema, toBackendQuery, type TableQuery } from "@/lib/api/data-table";
import { apiFetch } from "@/lib/api/server-api";
import {
  staffMemberSchema,
  staffMutationResponseSchema,
  toStaffMember,
  type StaffFilters,
  type StaffFormValues,
  type StaffMember,
} from "./schemas";

/**
 * Accès backend du domaine « personnel » — SERVEUR UNIQUEMENT.
 *
 * ⚠️ `UserFilterDto` côté NestJS est validé avec
 * `whitelist + forbidNonWhitelisted` : **tout paramètre inconnu fait échouer la
 * requête en 400**. En particulier `orderBy`/`order` n'y figurent pas — les
 * listes de personnel s'appellent donc sans tri, ce qu'assure `parseTableQuery`
 * tant qu'on ne lui passe pas de `sortableColumns`.
 */

const listSchema = paginatedSchema(staffMemberSchema, { key: "users" });

export type StaffPage = { items: StaffMember[]; total: number | null };

export async function listCompanyStaff(
  query: TableQuery,
  filters: StaffFilters,
  accessToken: string,
): Promise<StaffPage> {
  const result = await apiFetch("/user/getMyCompanyUsers", listSchema, {
    accessToken,
    query: {
      ...toBackendQuery(query),
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status === "blocked" ? { isBlocked: true } : {}),
      ...(filters.status === "active" ? { isBlocked: false, isActive: true } : {}),
    },
  });

  return { items: result.items.map(toStaffMember), total: result.total };
}

/**
 * Corps accepté par `POST /user/create` et `PATCH /user/:id`.
 *
 * On n'envoie **que** les champs pilotés par le formulaire. Le backend rejette
 * tout champ inconnu, et plusieurs champs connus sont interdits à un
 * `company_admin` (`walletAmount`, `companyId`, `sponsorshipCode`) : les
 * transmettre produirait une 401.
 */
function toBackendPayload(values: StaffFormValues) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email.toLowerCase(),
    phoneNumber: values.phoneNumber,
    role: values.role,
    lang: values.lang,
    ...(values.seatId ? { seatId: values.seatId } : {}),
    ...(values.cniNumber ? { cniNumber: values.cniNumber } : {}),
  };
}

/**
 * Crée un collaborateur.
 *
 * Aucun mot de passe n'est transmis : le backend en génère un, l'envoie par
 * e-mail au collaborateur et positionne `needPasswordUpdate`. L'administrateur
 * n'a donc jamais connaissance du mot de passe de ses employés.
 */
export async function createStaffMember(
  values: StaffFormValues,
  accessToken: string,
): Promise<StaffMember | null> {
  const response = await apiFetch("/user/create", staffMutationResponseSchema, {
    method: "POST",
    accessToken,
    body: toBackendPayload(values),
  });

  return response.user ? toStaffMember(response.user) : null;
}

export async function updateStaffMember(
  id: string,
  values: StaffFormValues,
  accessToken: string,
): Promise<StaffMember | null> {
  const response = await apiFetch(
    `/user/${encodeURIComponent(id)}`,
    staffMutationResponseSchema,
    { method: "PATCH", accessToken, body: toBackendPayload(values) },
  );

  return response.user ? toStaffMember(response.user) : null;
}

/**
 * Bloque ou débloque un collaborateur.
 *
 * Passe par `PATCH /user/:id`, seul chemin cloisonné par entreprise
 * (`assertSameCompany`). Le module `user-permission` du backend est un
 * squelette non implémenté — ne pas s'en servir.
 */
export async function setStaffBlocked(
  id: string,
  isBlocked: boolean,
  accessToken: string,
): Promise<void> {
  await apiFetch(`/user/${encodeURIComponent(id)}`, staffMutationResponseSchema, {
    method: "PATCH",
    accessToken,
    body: { isBlocked },
  });
}

/** Suppression logique (`softDelete` côté backend). */
export async function deleteStaffMember(
  id: string,
  accessToken: string,
): Promise<void> {
  await apiFetch(`/user/${encodeURIComponent(id)}`, z.unknown(), {
    method: "DELETE",
    accessToken,
  });
}

/**
 * Personnel affecté à une agence, pour sa fiche de détail.
 *
 * `GET /user/getBySeatId/:seatId` vérifie côté backend que l'agence appartient
 * bien à l'entreprise de l'appelant (403 sinon) : l'identifiant peut donc venir
 * d'un paramètre d'URL sans danger.
 */
export async function listSeatStaff(
  seatId: string,
  accessToken: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<StaffMember[]> {
  const result = await apiFetch(
    `/user/getBySeatId/${encodeURIComponent(seatId)}`,
    listSchema,
    { accessToken, query: { page: 0, count: limit } },
  );

  return result.items.map(toStaffMember);
}
