import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailTokenStatus } from "@/constants/auth-status";
import { PASSWORD_RESET_COOKIE } from "@/lib/auth/password-reset";

/**
 * Tests de la validation du code de réinitialisation.
 *
 * Le `reset_token` renvoyé par le backend autorise à lui seul le changement du
 * mot de passe : il doit rester dans le cookie `httpOnly` et ne jamais
 * apparaître dans la réponse HTTP.
 */

const { cookieJar, verifyPasswordResetCodeMock } = vi.hoisted(() => ({
  cookieJar: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn((): { name: string; value: string } | undefined => undefined),
  },
  verifyPasswordResetCodeMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
}));

vi.mock("@/features/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api")>();
  return { ...actual, verifyPasswordResetCode: verifyPasswordResetCodeMock };
});

const { POST } = await import("./route");

const APP_ORIGIN = "http://localhost:3000";
const RESET_TOKEN = "eyJhbGciOiJIUzI1NiJ9.reset-token-secret";

function givenPendingReset() {
  cookieJar.get.mockReturnValue({
    name: PASSWORD_RESET_COOKIE,
    value: JSON.stringify({ email: "chef@transport.example" }),
  });
}

let ipCounter = 0;
function verifyRequest(
  body: unknown,
  headers: Record<string, string> = { origin: APP_ORIGIN },
): Request {
  ipCounter += 1;
  return new Request(`${APP_ORIGIN}/api/auth/forgot-password/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.10.${ipCounter % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.get.mockReturnValue(undefined);
});

describe("POST /api/auth/forgot-password/verify", () => {
  it("range le jeton de réinitialisation dans le cookie, jamais dans la réponse", async () => {
    givenPendingReset();
    verifyPasswordResetCodeMock.mockResolvedValue({
      status: EmailTokenStatus.TRUST,
      reset_token: RESET_TOKEN,
    });

    const response = await POST(verifyRequest({ code: "428913" }));
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(body).not.toContain(RESET_TOKEN);
    expect(cookieJar.set).toHaveBeenCalledWith(
      PASSWORD_RESET_COOKIE,
      JSON.stringify({ email: "chef@transport.example", resetToken: RESET_TOKEN }),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it("refuse un statut de succès sans jeton", async () => {
    givenPendingReset();
    verifyPasswordResetCodeMock.mockResolvedValue({ status: EmailTokenStatus.TRUST });

    const response = await POST(verifyRequest({ code: "428913" }));

    expect(response.status).toBe(400);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it("distingue un code expiré d'un code erroné", async () => {
    givenPendingReset();
    verifyPasswordResetCodeMock.mockResolvedValue({ status: EmailTokenStatus.EXPIRED });
    const expired = await POST(verifyRequest({ code: "428913" }));
    expect((await expired.json()).message).toBe(
      "Ce code a expiré. Demandez-en un nouveau.",
    );

    givenPendingReset();
    verifyPasswordResetCodeMock.mockResolvedValue({ status: EmailTokenStatus.FAKE });
    const wrong = await POST(verifyRequest({ code: "428913" }));
    expect((await wrong.json()).message).toBe(
      "Code incorrect. Vérifiez le dernier e-mail reçu.",
    );
  });

  it("refuse toute validation sans demande en cours", async () => {
    const response = await POST(verifyRequest({ code: "428913" }));

    expect(response.status).toBe(409);
    expect(verifyPasswordResetCodeMock).not.toHaveBeenCalled();
  });

  it("refuse une requête d'origine tierce (CSRF)", async () => {
    givenPendingReset();

    const response = await POST(
      verifyRequest({ code: "428913" }, { origin: "https://evil.example" }),
    );

    expect(response.status).toBe(403);
    expect(verifyPasswordResetCodeMock).not.toHaveBeenCalled();
  });

  // Le backend cherche ce code sans identifiant de compte : une force brute
  // réussie délivrerait un jeton de réinitialisation.
  it("limite les tentatives de code par IP", async () => {
    verifyPasswordResetCodeMock.mockResolvedValue({ status: EmailTokenStatus.FAKE });
    const sameIp = { origin: APP_ORIGIN, "x-forwarded-for": "203.0.113.77" };

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 9; attempt += 1) {
      givenPendingReset();
      const response = await POST(
        new Request(`${APP_ORIGIN}/api/auth/forgot-password/verify`, {
          method: "POST",
          headers: { "content-type": "application/json", ...sameIp },
          body: JSON.stringify({ code: "428913" }),
        }),
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 8)).toEqual(new Array(8).fill(400));
    expect(statuses[8]).toBe(429);
  });
});
