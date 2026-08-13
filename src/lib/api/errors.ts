import { z } from "zod";

/** Erreur normalisée de l'API NestJS. */
export class ApiError extends Error {
  readonly status: number;
  /** Code métier renvoyé par le backend (ex. `wrong_password`). */
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; details?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/** Corps d'erreur standard de NestJS (`HttpException`). */
const nestErrorSchema = z
  .object({
    message: z.union([z.string(), z.array(z.string())]).optional(),
    error: z.string().optional(),
    statusCode: z.number().optional(),
  })
  .loose();

/** Construit une `ApiError` lisible à partir d'une réponse HTTP en échec. */
export async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const parsed = nestErrorSchema.safeParse(payload);
  if (!parsed.success) {
    return new ApiError(response.statusText || "errors.serverError", response.status);
  }

  const { message, error } = parsed.data;
  const text = Array.isArray(message) ? message.join(", ") : message;

  return new ApiError(text || error || "errors.serverError", response.status, {
    // NestJS place le code métier dans `message` pour les ForbiddenException
    // custom (ex. `account_blocked`), et le libellé HTTP dans `error`.
    code: typeof message === "string" ? message : error,
    details: payload,
  });
}

/**
 * Traducteur minimal attendu par `toUserMessage`.
 *
 * Réduit à ce qui est réellement utilisé, pour que ce module reste importable
 * sans dépendre de next-intl : `getTranslations()` s'y conforme.
 */
export type ErrorTranslator = {
  (key: string): string;
  has(key: string): boolean;
};

/**
 * Message affichable par l'utilisateur final.
 *
 * En production on n'expose jamais le détail technique d'une 5xx : cela peut
 * révéler la structure de la base ou des chemins de fichiers.
 *
 * Le traducteur est passé en argument plutôt qu'importé : cette fonction est
 * appelée depuis des route handlers et des Server Actions, où la langue est
 * celle de la requête en cours. Un message de 4xx provient du backend et n'est
 * pas traduisible — il n'est traduit que s'il s'agit d'une clé de catalogue
 * posée par `toApiError`.
 */
export function toUserMessage(error: unknown, t: ErrorTranslator): string {
  if (error instanceof ApiError) {
    if (error.status >= 500) return t("errors.unavailable");
    return t.has(error.message) ? t(error.message) : error.message;
  }
  return t("errors.unexpected");
}
