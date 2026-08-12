import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginStatus } from "@/constants/auth-status";
import { UserRole } from "@/constants/roles";
import { ApiError } from "@/lib/api/errors";

/**
 * Tests du point d'entrée d'authentification.
 *
 * Ce handler est la seule porte par laquelle une session peut naître : c'est
 * lui qui décide quel rôle obtient un cookie sur CE dashboard. Le backend, lui,
 * accepte volontiers un agent ou un chauffeur sur `POST /auth/login`.
 */

const { cookieJar, loginMock } = vi.hoisted(() => ({
  // `get` sert à la langue : le route handler ne l'amorce que si l'utilisateur
  // n'a pas déjà choisi. Par défaut, aucun cookie n'est posé.
  cookieJar: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn((): { name: string; value: string } | undefined => undefined),
  },
  loginMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
}));

vi.mock("@/features/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api")>();
  // `isSuccessfulLogin` reste le vrai : c'est une partie du contrat testé.
  return { ...actual, login: loginMock };
});

const { POST } = await import("./route");

const APP_ORIGIN = "http://localhost:3000";

/** Une IP distincte par requête : le quota du limiteur est global au module. */
let ipCounter = 0;
function loginRequest(
  body: unknown,
  headers: Record<string, string> = { origin: APP_ORIGIN },
): Request {
  ipCounter += 1;
  return new Request(`${APP_ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${ipCounter % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const CREDENTIALS = { login: "chef@transport.example", password: "Sup3r-Secret!" };

function backendSuccess(role: string, lang?: string) {
  return {
    status: LoginStatus.SUCCESS,
    access_token: "access-token-abc",
    refresh_token: "refresh-token-def",
    user: {
      id: "u-1",
      userName: "chef",
      firstName: "Yao",
      lastName: "Kouassi",
      email: "chef@transport.example",
      role,
      ...(lang ? { lang } : {}),
      password: "$2b$10$hash",
      salt: "sel",
      company: { id: "c-1", name: "Transports Atlantique", isActive: true },
    },
  };
}

/** Noms des cookies posés au cours d'une requête. */
function cookieNames(): string[] {
  return cookieJar.set.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/login — cloisonnement des rôles", () => {
  it("ouvre une session à un chef d'entreprise", async () => {
    loginMock.mockResolvedValue(backendSuccess(UserRole.COMPANY_ADMIN));

    const response = await POST(loginRequest(CREDENTIALS));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe(LoginStatus.SUCCESS);
    expect(cookieJar.set).toHaveBeenCalledTimes(2);
  });

  it("amorce la langue d'interface avec la préférence du compte", async () => {
    loginMock.mockResolvedValue(backendSuccess(UserRole.COMPANY_ADMIN, "en"));

    await POST(loginRequest(CREDENTIALS));

    expect(cookieNames()).toContain("travelas_locale");
    const localeCall = cookieJar.set.mock.calls.find(
      (call) => call[0] === "travelas_locale",
    );
    expect(localeCall?.[1]).toBe("en");
  });

  it("n'écrase pas une langue déjà choisie dans le sélecteur", async () => {
    cookieJar.get.mockReturnValueOnce({ name: "travelas_locale", value: "fr" });
    loginMock.mockResolvedValue(backendSuccess(UserRole.COMPANY_ADMIN, "en"));

    await POST(loginRequest(CREDENTIALS));

    expect(cookieNames()).not.toContain("travelas_locale");
  });

  // Le cœur du cloisonnement : ces comptes ont des identifiants valides.
  it.each([
    UserRole.COMPANY_AGENT,
    UserRole.COMPANY_DRIVER,
    UserRole.AGENCY_ADMIN,
    UserRole.USER,
    UserRole.SUPER_ADMIN,
  ])("refuse un compte %s et ne pose aucun cookie", async (role) => {
    loginMock.mockResolvedValue(backendSuccess(role));

    const response = await POST(loginRequest(CREDENTIALS));

    expect(response.status).toBe(403);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it("pose des cookies httpOnly, jamais lisibles par JavaScript", async () => {
    loginMock.mockResolvedValue(backendSuccess(UserRole.COMPANY_ADMIN));

    await POST(loginRequest(CREDENTIALS));

    for (const call of cookieJar.set.mock.calls) {
      expect(call[2]).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    }
  });

  it("ne renvoie jamais l'entité brute du backend", async () => {
    loginMock.mockResolvedValue(backendSuccess(UserRole.COMPANY_ADMIN));

    const response = await POST(loginRequest(CREDENTIALS));
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain("$2b$10$hash");
    expect(body).not.toContain("sel");
    expect(body).not.toContain("access-token-abc");
    expect(body).not.toContain("refresh-token-def");
  });
});

describe("POST /api/auth/login — échecs métier", () => {
  it("traduit un mot de passe erroné en 401 sans révéler la cause", async () => {
    loginMock.mockResolvedValue({ status: LoginStatus.WRONG_PASSWORD });

    const response = await POST(loginRequest(CREDENTIALS));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.message).toBe("Identifiants invalides.");
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it("donne le même message pour un compte inexistant (anti-énumération)", async () => {
    loginMock.mockResolvedValue({ status: LoginStatus.ACCOUNT_DOESNT_EXIST });

    const payload = await (await POST(loginRequest(CREDENTIALS))).json();
    expect(payload.message).toBe("Identifiants invalides.");
  });

  it("renvoie 200 pour une rotation de mot de passe exigée", async () => {
    loginMock.mockResolvedValue({ status: LoginStatus.NEED_PASSWORD_UPDATE });

    const response = await POST(loginRequest(CREDENTIALS));

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe(LoginStatus.NEED_PASSWORD_UPDATE);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  /**
   * Compte créé mais jamais vérifié : sans reprise, l'utilisateur est dans une
   * impasse — il ne peut ni se connecter, ni se réinscrire (téléphone et
   * identifiant déjà pris). Le backend n'accompagne ce statut de l'identité du
   * compte qu'après avoir validé le mot de passe.
   */
  it("rouvre le parcours de vérification pour un compte non vérifié", async () => {
    loginMock.mockResolvedValue({
      status: LoginStatus.ACCOUNT_NOT_VERIFIED,
      userId: "u-42",
      email: "Chef@Transport.Example",
    });

    const response = await POST(loginRequest(CREDENTIALS));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.canResumeVerification).toBe(true);
    expect(cookieJar.set).toHaveBeenCalledWith(
      "travelas_pending_registration",
      JSON.stringify({ userId: "u-42", email: "chef@transport.example" }),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    // L'identifiant du compte reste côté serveur.
    expect(JSON.stringify(payload)).not.toContain("u-42");
  });

  it("n'ouvre rien si le backend ne désigne pas de compte", async () => {
    // Cas d'un backend antérieur au correctif : le statut arrivait seul, sans
    // preuve que l'appelant soit le titulaire du compte.
    loginMock.mockResolvedValue({ status: LoginStatus.ACCOUNT_NOT_VERIFIED });

    const response = await POST(loginRequest(CREDENTIALS));
    const payload = await response.json();

    expect(payload.canResumeVerification).toBeUndefined();
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  // Le backend lève une 403 (et non un statut 200) pour un compte bloqué.
  it("relaie le blocage de compte remonté en 403 par le backend", async () => {
    loginMock.mockRejectedValue(
      new ApiError(LoginStatus.ACCOUNT_BLOCKED, 403, {
        code: LoginStatus.ACCOUNT_BLOCKED,
      }),
    );

    const response = await POST(loginRequest(CREDENTIALS));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.status).toBe(LoginStatus.ACCOUNT_BLOCKED);
  });

  it("masque le détail technique d'une panne backend", async () => {
    loginMock.mockRejectedValue(
      new ApiError("ER_NO_SUCH_TABLE: Table 'travelas.user' doesn't exist", 500),
    );

    const response = await POST(loginRequest(CREDENTIALS));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.message).not.toContain("travelas.user");
  });
});

describe("POST /api/auth/login — garde-fous du point d'entrée", () => {
  it("refuse une requête d'origine tierce (CSRF)", async () => {
    const response = await POST(
      loginRequest(CREDENTIALS, { origin: "https://evil.example" }),
    );

    expect(response.status).toBe(403);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("refuse un corps invalide sans appeler le backend", async () => {
    const response = await POST(loginRequest({ login: "", password: "" }));

    expect(response.status).toBe(400);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("normalise l'identifiant en minuscules avant l'appel backend", async () => {
    loginMock.mockResolvedValue(backendSuccess(UserRole.COMPANY_ADMIN));

    await POST(loginRequest({ ...CREDENTIALS, login: "Chef@Transport.Example" }));

    expect(loginMock).toHaveBeenCalledWith(
      expect.objectContaining({ login: "chef@transport.example" }),
    );
  });

  it("limite le bourrage d'identifiants par IP", async () => {
    loginMock.mockResolvedValue({ status: LoginStatus.WRONG_PASSWORD });
    const sameIp = { origin: APP_ORIGIN, "x-forwarded-for": "203.0.113.42" };

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await POST(
        new Request(`${APP_ORIGIN}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json", ...sameIp },
          body: JSON.stringify(CREDENTIALS),
        }),
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10)).toEqual(new Array(10).fill(401));
    expect(statuses[10]).toBe(429);
  });
});
