import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterStatus } from "@/constants/auth-status";
import { ApiError } from "@/lib/api/errors";
import { PENDING_REGISTRATION_COOKIE } from "@/lib/auth/pending-registration";

/**
 * Tests du point d'entrée d'inscription.
 *
 * Trois propriétés à ne pas perdre : le backend renvoie l'entité complète du
 * compte créé (mot de passe haché et sel compris) et rien de tout cela ne doit
 * ressortir ; l'identifiant du compte reste dans un cookie `httpOnly` ; et
 * chaque appel déclenche un envoi d'e-mail, donc doit être limité en débit.
 */

const { cookieJar, registerMock } = vi.hoisted(() => ({
  cookieJar: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn((): { name: string; value: string } | undefined => undefined),
  },
  registerMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
}));

vi.mock("@/features/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api")>();
  // `registerFailureStatus` reste le vrai : la forme du corps d'erreur est
  // précisément ce qu'on veut vérifier.
  return { ...actual, register: registerMock };
});

const { POST } = await import("./route");

const APP_ORIGIN = "http://localhost:3000";

const VALID_INPUT = {
  firstName: "Yao",
  lastName: "Kouassi",
  userName: "yao.kouassi",
  email: "Chef@Transport.Example",
  phoneNumber: "+2250700000000",
  password: "Transport-2026!",
  confirmPassword: "Transport-2026!",
};

/** Une IP distincte par requête : le quota du limiteur est global au module. */
let ipCounter = 0;
function registerRequest(
  body: unknown,
  headers: Record<string, string> = { origin: APP_ORIGIN },
): Request {
  ipCounter += 1;
  return new Request(`${APP_ORIGIN}/api/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `192.0.2.${ipCounter % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** Réponse du backend : l'entité TypeORM entière, secrets compris. */
function backendCreated() {
  return {
    status: RegisterStatus.CREATED,
    user: {
      id: "u-42",
      email: "chef@transport.example",
      password: "$2b$10$hash",
      salt: "sel",
      role: "company_admin",
    },
  };
}

/** Corps d'erreur réel du backend : `BadRequestException` ré-emballée. */
function duplicateError(status: string) {
  return new ApiError("Bad Request Exception", 400, {
    details: { response: { status }, status: 400 },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/register — création du compte", () => {
  it("crée le compte et retient l'inscription dans un cookie httpOnly", async () => {
    registerMock.mockResolvedValue(backendCreated());

    const response = await POST(registerRequest(VALID_INPUT));

    expect(response.status).toBe(201);
    expect(cookieJar.set).toHaveBeenCalledWith(
      PENDING_REGISTRATION_COOKIE,
      JSON.stringify({ userId: "u-42", email: "chef@transport.example" }),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it("ne renvoie ni l'entité du compte ni le mot de passe", async () => {
    registerMock.mockResolvedValue(backendCreated());

    const response = await POST(registerRequest(VALID_INPUT));
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain("$2b$10$hash");
    expect(body).not.toContain("sel");
    expect(body).not.toContain("Transport-2026!");
    // L'identifiant du compte reste côté serveur, dans le cookie.
    expect(body).not.toContain("u-42");
  });

  it("normalise l'e-mail et l'identifiant, et n'envoie pas la confirmation du mot de passe", async () => {
    registerMock.mockResolvedValue(backendCreated());

    await POST(registerRequest({ ...VALID_INPUT, userName: "Yao.Kouassi" }));

    const payload = registerMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      email: "chef@transport.example",
      userName: "yao.kouassi",
      lang: "fr",
    });
    // `forbidNonWhitelisted` côté backend : un champ en trop ferait une 400.
    expect(payload).not.toHaveProperty("confirmPassword");
  });

  it("ne pose aucun cookie si le backend n'a pas créé le compte", async () => {
    registerMock.mockResolvedValue({ status: "unauthentified user" });

    const response = await POST(registerRequest(VALID_INPUT));

    expect(response.status).toBe(400);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/register — doublons", () => {
  it.each([
    [RegisterStatus.DUPLICATE_EMAIL, "email", "Un compte existe déjà avec cet e-mail."],
    [
      RegisterStatus.DUPLICATE_PHONE,
      "phoneNumber",
      "Un compte existe déjà avec ce numéro.",
    ],
    [RegisterStatus.DUPLICATE_USERNAME, "userName", "Cet identifiant est déjà pris."],
  ])("rattache « %s » à son champ", async (status, field, expected) => {
    registerMock.mockRejectedValue(duplicateError(status));

    const response = await POST(registerRequest(VALID_INPUT));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.fieldErrors[field]).toBe(expected);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it("renvoie le champ téléphone quand le DTO refuse le numéro", async () => {
    registerMock.mockRejectedValue(
      new ApiError("phoneNumber must be a valid phone number", 400),
    );

    const response = await POST(registerRequest(VALID_INPUT));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.fieldErrors.phoneNumber).toContain("+2250700000000");
  });

  it("masque le détail technique d'une panne backend", async () => {
    registerMock.mockRejectedValue(
      new ApiError("ER_NO_SUCH_TABLE: Table 'travelas.user' doesn't exist", 500),
    );

    const response = await POST(registerRequest(VALID_INPUT));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.message).not.toContain("travelas.user");
  });
});

describe("POST /api/auth/register — garde-fous du point d'entrée", () => {
  it("refuse une requête d'origine tierce (CSRF)", async () => {
    const response = await POST(
      registerRequest(VALID_INPUT, { origin: "https://evil.example" }),
    );

    expect(response.status).toBe(403);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "mot de passe trop faible",
      { ...VALID_INPUT, password: "azerty", confirmPassword: "azerty" },
    ],
    ["confirmation différente", { ...VALID_INPUT, confirmPassword: "Transport-2027!" }],
    ["téléphone sans indicatif", { ...VALID_INPUT, phoneNumber: "0700000000" }],
    ["e-mail invalide", { ...VALID_INPUT, email: "chef@" }],
  ])("refuse un corps invalide (%s) sans appeler le backend", async (_case, body) => {
    const response = await POST(registerRequest(body));

    expect(response.status).toBe(400);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("limite les créations de compte par IP", async () => {
    registerMock.mockResolvedValue(backendCreated());
    const sameIp = { origin: APP_ORIGIN, "x-forwarded-for": "203.0.113.7" };

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await POST(
        new Request(`${APP_ORIGIN}/api/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json", ...sameIp },
          body: JSON.stringify(VALID_INPUT),
        }),
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5)).toEqual(new Array(5).fill(201));
    expect(statuses[5]).toBe(429);
  });
});
