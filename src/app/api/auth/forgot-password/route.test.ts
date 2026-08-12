import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { PASSWORD_RESET_COOKIE } from "@/lib/auth/password-reset";

/**
 * Tests de la demande de réinitialisation.
 *
 * L'enjeu tient en une propriété : **la réponse ne doit pas révéler si un
 * compte existe**. Le backend, lui, lève une 400 pour une adresse inconnue —
 * la relayer transformerait ce formulaire en outil d'énumération des chefs
 * d'entreprise partenaires.
 */

const { cookieJar, requestPasswordResetCodeMock } = vi.hoisted(() => ({
  cookieJar: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn((): { name: string; value: string } | undefined => undefined),
  },
  requestPasswordResetCodeMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
}));

vi.mock("@/features/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api")>();
  return { ...actual, requestPasswordResetCode: requestPasswordResetCodeMock };
});

const { POST } = await import("./route");

const APP_ORIGIN = "http://localhost:3000";

let ipCounter = 0;
function forgotRequest(
  body: unknown,
  headers: Record<string, string> = { origin: APP_ORIGIN },
): Request {
  ipCounter += 1;
  return new Request(`${APP_ORIGIN}/api/auth/forgot-password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.0.${ipCounter % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** Nom des cookies posés au cours de la requête. */
function cookieNames(): string[] {
  return cookieJar.set.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/forgot-password", () => {
  it("envoie le code et retient l'adresse dans un cookie httpOnly", async () => {
    requestPasswordResetCodeMock.mockResolvedValue({ status: "send" });

    const response = await POST(forgotRequest({ email: "Chef@Transport.Example" }));

    expect(response.status).toBe(200);
    expect(requestPasswordResetCodeMock).toHaveBeenCalledWith("chef@transport.example");
    expect(cookieJar.set).toHaveBeenCalledWith(
      PASSWORD_RESET_COOKIE,
      JSON.stringify({ email: "chef@transport.example" }),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  // Le cœur du test : compte inconnu et compte existant sont indiscernables,
  // cookie compris — son absence trahirait la même information.
  it("répond exactement pareil pour une adresse inconnue", async () => {
    requestPasswordResetCodeMock.mockResolvedValue({ status: "send" });
    const known = await POST(forgotRequest({ email: "chef@transport.example" }));
    const knownBody = await known.json();
    const knownCookies = cookieNames();

    // Même adresse soumise, seul le verdict du backend change : la réponse
    // observable doit rester identique au caractère près.
    vi.clearAllMocks();
    requestPasswordResetCodeMock.mockRejectedValue(new ApiError("Not Found", 400));
    const unknown = await POST(forgotRequest({ email: "chef@transport.example" }));

    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(knownBody);
    expect(cookieNames()).toEqual(knownCookies);
  });

  it("signale en revanche une panne réelle du backend", async () => {
    requestPasswordResetCodeMock.mockRejectedValue(new ApiError("boom", 500));

    const response = await POST(forgotRequest({ email: "chef@transport.example" }));

    // Taire une panne ferait attendre un e-mail qui n'arrivera jamais.
    expect(response.status).toBe(502);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it("refuse une adresse mal formée sans appeler le backend", async () => {
    const response = await POST(forgotRequest({ email: "chef@" }));

    expect(response.status).toBe(400);
    expect(requestPasswordResetCodeMock).not.toHaveBeenCalled();
  });

  it("refuse une requête d'origine tierce (CSRF)", async () => {
    const response = await POST(
      forgotRequest(
        { email: "chef@transport.example" },
        { origin: "https://evil.example" },
      ),
    );

    expect(response.status).toBe(403);
    expect(requestPasswordResetCodeMock).not.toHaveBeenCalled();
  });

  it("limite les envois par IP", async () => {
    requestPasswordResetCodeMock.mockResolvedValue({ status: "send" });
    const sameIp = { origin: APP_ORIGIN, "x-forwarded-for": "203.0.113.55" };

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await POST(
        new Request(`${APP_ORIGIN}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "content-type": "application/json", ...sameIp },
          body: JSON.stringify({ email: "chef@transport.example" }),
        }),
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5)).toEqual(new Array(5).fill(200));
    expect(statuses[5]).toBe(429);
  });
});
