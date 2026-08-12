import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { PENDING_REGISTRATION_COOKIE } from "@/lib/auth/pending-registration";

/**
 * Tests de la correction d'adresse en cours d'inscription.
 *
 * `POST /auth/updateUnverifyEmail` est une route **ouverte** du backend : depuis
 * le chantier H, elle n'accepte l'opération que si le `userId` fourni est bien
 * celui du compte portant l'ancienne adresse. Ce test verrouille le point qui
 * rend la garde efficace : cet identifiant vient du cookie `httpOnly`, jamais
 * du corps de la requête.
 */

const { cookieJar, updateUnverifiedEmailMock } = vi.hoisted(() => ({
  cookieJar: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn((): { name: string; value: string } | undefined => undefined),
  },
  updateUnverifiedEmailMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
}));

vi.mock("@/features/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api")>();
  return { ...actual, updateUnverifiedEmail: updateUnverifiedEmailMock };
});

const { POST } = await import("./route");

const APP_ORIGIN = "http://localhost:3000";

function givenPendingRegistration() {
  cookieJar.get.mockReturnValue({
    name: PENDING_REGISTRATION_COOKIE,
    value: JSON.stringify({ userId: "u-42", email: "faute@transport.example" }),
  });
}

let ipCounter = 0;
function changeEmailRequest(
  body: unknown,
  headers: Record<string, string> = { origin: APP_ORIGIN },
): Request {
  ipCounter += 1;
  return new Request(`${APP_ORIGIN}/api/auth/change-email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.30.${ipCounter % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.get.mockReturnValue(undefined);
});

describe("POST /api/auth/change-email", () => {
  it("prend l'identifiant et l'ancienne adresse dans le cookie, pas dans la requête", async () => {
    givenPendingRegistration();
    updateUnverifiedEmailMock.mockResolvedValue({ status: "update_successfuly" });

    const response = await POST(
      changeEmailRequest({
        email: "Bonne@Transport.Example",
        userId: "u-999",
        oldEmail: "victime@transport.example",
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUnverifiedEmailMock).toHaveBeenCalledWith({
      userId: "u-42",
      oldEmail: "faute@transport.example",
      newEmail: "bonne@transport.example",
    });
  });

  it("met à jour l'adresse retenue pour la suite du parcours", async () => {
    givenPendingRegistration();
    updateUnverifiedEmailMock.mockResolvedValue({ status: "update_successfuly" });

    await POST(changeEmailRequest({ email: "bonne@transport.example" }));

    expect(cookieJar.set).toHaveBeenCalledWith(
      PENDING_REGISTRATION_COOKIE,
      JSON.stringify({ userId: "u-42", email: "bonne@transport.example" }),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it("signale une adresse déjà utilisée", async () => {
    givenPendingRegistration();
    updateUnverifiedEmailMock.mockRejectedValue(
      new ApiError("Bad Request Exception", 400, {
        details: { response: { status: "duplicate email" }, status: 400 },
      }),
    );

    const response = await POST(
      changeEmailRequest({ email: "prise@transport.example" }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).message).toBe(
      "Un compte existe déjà avec cet e-mail.",
    );
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it("refuse sans inscription en attente", async () => {
    const response = await POST(
      changeEmailRequest({ email: "bonne@transport.example" }),
    );

    expect(response.status).toBe(409);
    expect(updateUnverifiedEmailMock).not.toHaveBeenCalled();
  });

  it("refuse une requête d'origine tierce (CSRF)", async () => {
    givenPendingRegistration();

    const response = await POST(
      changeEmailRequest(
        { email: "bonne@transport.example" },
        { origin: "https://evil.example" },
      ),
    );

    expect(response.status).toBe(403);
    expect(updateUnverifiedEmailMock).not.toHaveBeenCalled();
  });
});
