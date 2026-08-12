import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailTokenStatus } from "@/constants/auth-status";
import { PENDING_REGISTRATION_COOKIE } from "@/lib/auth/pending-registration";

/**
 * Tests de la vérification d'e-mail.
 *
 * Le point sensible : le compte vérifié est celui du cookie `httpOnly`, jamais
 * celui du corps de la requête. Sans cela, changer un identifiant suffirait à
 * faire valider l'adresse d'un compte tiers.
 */

const { cookieJar, confirmEmailTokenMock } = vi.hoisted(() => ({
  cookieJar: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn((): { name: string; value: string } | undefined => undefined),
  },
  confirmEmailTokenMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
}));

vi.mock("@/features/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api")>();
  return { ...actual, confirmEmailToken: confirmEmailTokenMock };
});

const { POST } = await import("./route");

const APP_ORIGIN = "http://localhost:3000";

/** Simule l'inscription en attente posée par `/api/auth/register`. */
function givenPendingRegistration() {
  cookieJar.get.mockReturnValue({
    name: PENDING_REGISTRATION_COOKIE,
    value: JSON.stringify({ userId: "u-42", email: "chef@transport.example" }),
  });
}

let ipCounter = 0;
function verifyRequest(
  body: unknown,
  headers: Record<string, string> = { origin: APP_ORIGIN },
): Request {
  ipCounter += 1;
  return new Request(`${APP_ORIGIN}/api/auth/verify-email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.18.0.${ipCounter % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.get.mockReturnValue(undefined);
});

describe("POST /api/auth/verify-email", () => {
  it("vérifie le compte du cookie, pas un identifiant fourni par le client", async () => {
    givenPendingRegistration();
    confirmEmailTokenMock.mockResolvedValue({ status: EmailTokenStatus.TRUST });

    const response = await POST(verifyRequest({ code: "100420", userId: "u-999" }));

    expect(response.status).toBe(200);
    expect(confirmEmailTokenMock).toHaveBeenCalledWith({
      token: "100420",
      userId: "u-42",
    });
  });

  it("efface le cookie d'attente une fois l'adresse confirmée", async () => {
    givenPendingRegistration();
    confirmEmailTokenMock.mockResolvedValue({ status: EmailTokenStatus.TRUST });

    await POST(verifyRequest({ code: "100420" }));

    expect(cookieJar.delete).toHaveBeenCalledWith({
      name: PENDING_REGISTRATION_COOKIE,
      path: "/",
    });
  });

  it("distingue un code expiré d'un code erroné", async () => {
    givenPendingRegistration();
    confirmEmailTokenMock.mockResolvedValue({ status: EmailTokenStatus.EXPIRED });

    const expired = await POST(verifyRequest({ code: "100420" }));
    expect((await expired.json()).message).toBe(
      "Ce code a expiré. Demandez-en un nouveau.",
    );

    givenPendingRegistration();
    confirmEmailTokenMock.mockResolvedValue({ status: EmailTokenStatus.FAKE });

    const wrong = await POST(verifyRequest({ code: "100420" }));
    expect((await wrong.json()).message).toBe(
      "Code incorrect. Vérifiez le dernier e-mail reçu.",
    );
    expect(cookieJar.delete).not.toHaveBeenCalled();
  });

  it("refuse toute vérification sans inscription en attente", async () => {
    const response = await POST(verifyRequest({ code: "100420" }));

    expect(response.status).toBe(409);
    expect(confirmEmailTokenMock).not.toHaveBeenCalled();
  });

  it("ignore un cookie d'attente illisible", async () => {
    cookieJar.get.mockReturnValue({
      name: PENDING_REGISTRATION_COOKIE,
      value: "{ pas du json",
    });

    const response = await POST(verifyRequest({ code: "100420" }));

    expect(response.status).toBe(409);
    expect(confirmEmailTokenMock).not.toHaveBeenCalled();
  });

  it("refuse un code non numérique sans appeler le backend", async () => {
    givenPendingRegistration();

    const response = await POST(verifyRequest({ code: "abcdef" }));

    expect(response.status).toBe(400);
    expect(confirmEmailTokenMock).not.toHaveBeenCalled();
  });

  it("refuse une requête d'origine tierce (CSRF)", async () => {
    givenPendingRegistration();

    const response = await POST(
      verifyRequest({ code: "100420" }, { origin: "https://evil.example" }),
    );

    expect(response.status).toBe(403);
    expect(confirmEmailTokenMock).not.toHaveBeenCalled();
  });

  // Le backend tire le code dans un intervalle de 9 000 valeurs : sans quota,
  // il serait devinable par force brute en quelques minutes.
  it("limite les tentatives de code par IP", async () => {
    confirmEmailTokenMock.mockResolvedValue({ status: EmailTokenStatus.FAKE });
    const sameIp = { origin: APP_ORIGIN, "x-forwarded-for": "203.0.113.99" };

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      givenPendingRegistration();
      const response = await POST(
        new Request(`${APP_ORIGIN}/api/auth/verify-email`, {
          method: "POST",
          headers: { "content-type": "application/json", ...sameIp },
          body: JSON.stringify({ code: "100420" }),
        }),
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10)).toEqual(new Array(10).fill(400));
    expect(statuses[10]).toBe(429);
  });
});
