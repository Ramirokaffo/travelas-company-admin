import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { PASSWORD_RESET_COOKIE } from "@/lib/auth/password-reset";

/**
 * Tests du changement de mot de passe.
 *
 * Deux propriétés : le jeton vient du cookie et non du corps de la requête, et
 * il est effacé dès qu'il a servi — un jeton encore valable 30 minutes n'a
 * aucune raison de survivre à son usage.
 */

const { cookieJar, resetPasswordMock } = vi.hoisted(() => ({
  cookieJar: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn((): { name: string; value: string } | undefined => undefined),
  },
  resetPasswordMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
}));

vi.mock("@/features/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api")>();
  return { ...actual, resetPassword: resetPasswordMock };
});

const { POST } = await import("./route");

const APP_ORIGIN = "http://localhost:3000";
const RESET_TOKEN = "eyJhbGciOiJIUzI1NiJ9.reset-token-secret";
const NEW_PASSWORD = {
  password: "Transport-2027!",
  confirmPassword: "Transport-2027!",
};

function givenVerifiedReset() {
  cookieJar.get.mockReturnValue({
    name: PASSWORD_RESET_COOKIE,
    value: JSON.stringify({ email: "chef@transport.example", resetToken: RESET_TOKEN }),
  });
}

let ipCounter = 0;
function resetRequest(
  body: unknown,
  headers: Record<string, string> = { origin: APP_ORIGIN },
): Request {
  ipCounter += 1;
  return new Request(`${APP_ORIGIN}/api/auth/forgot-password/reset`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.20.${ipCounter % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.get.mockReturnValue(undefined);
});

describe("POST /api/auth/forgot-password/reset", () => {
  it("utilise le jeton du cookie et l'efface une fois servi", async () => {
    givenVerifiedReset();
    resetPasswordMock.mockResolvedValue({ status: "ok" });

    const response = await POST(resetRequest(NEW_PASSWORD));

    expect(response.status).toBe(200);
    expect(resetPasswordMock).toHaveBeenCalledWith("Transport-2027!", RESET_TOKEN);
    expect(cookieJar.delete).toHaveBeenCalledWith({
      name: PASSWORD_RESET_COOKIE,
      path: "/",
    });
  });

  it("ne renvoie jamais le mot de passe ni le jeton", async () => {
    givenVerifiedReset();
    resetPasswordMock.mockResolvedValue({ status: "ok" });

    const body = JSON.stringify(await (await POST(resetRequest(NEW_PASSWORD))).json());

    expect(body).not.toContain("Transport-2027!");
    expect(body).not.toContain(RESET_TOKEN);
  });

  it("refuse un code validé mais un mot de passe trop faible", async () => {
    givenVerifiedReset();

    const response = await POST(
      resetRequest({ password: "azerty", confirmPassword: "azerty" }),
    );

    expect(response.status).toBe(400);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("refuse deux saisies différentes", async () => {
    givenVerifiedReset();

    const response = await POST(
      resetRequest({ password: "Transport-2027!", confirmPassword: "Transport-2028!" }),
    );

    expect(response.status).toBe(400);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("exige un code déjà validé", async () => {
    // Demande en cours, mais code non encore validé : pas de jeton.
    cookieJar.get.mockReturnValue({
      name: PASSWORD_RESET_COOKIE,
      value: JSON.stringify({ email: "chef@transport.example" }),
    });

    const response = await POST(resetRequest(NEW_PASSWORD));

    expect(response.status).toBe(409);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("traduit le refus d'un mot de passe identique au précédent", async () => {
    givenVerifiedReset();
    resetPasswordMock.mockRejectedValue(
      new ApiError("New password must be different to the old password", 400),
    );

    const response = await POST(resetRequest(NEW_PASSWORD));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe(
      "Choisissez un mot de passe différent du précédent.",
    );
  });

  it("efface le cookie et renvoie au début quand le jeton a expiré", async () => {
    givenVerifiedReset();
    resetPasswordMock.mockRejectedValue(new ApiError("Unauthorized", 401));

    const response = await POST(resetRequest(NEW_PASSWORD));

    expect(response.status).toBe(409);
    expect(cookieJar.delete).toHaveBeenCalledWith({
      name: PASSWORD_RESET_COOKIE,
      path: "/",
    });
  });

  it("refuse une requête d'origine tierce (CSRF)", async () => {
    givenVerifiedReset();

    const response = await POST(
      resetRequest(NEW_PASSWORD, { origin: "https://evil.example" }),
    );

    expect(response.status).toBe(403);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });
});
