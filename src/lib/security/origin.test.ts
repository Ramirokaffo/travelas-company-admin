import { describe, expect, it } from "vitest";

import { CsrfError, assertSameOrigin } from "./origin";

const APP_ORIGIN = "http://localhost:3000";

function mutation(headers: Record<string, string>): Request {
  return new Request(`${APP_ORIGIN}/api/auth/login`, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("laisse passer une requête de même origine", () => {
    expect(() => assertSameOrigin(mutation({ origin: APP_ORIGIN }))).not.toThrow();
  });

  it("se rabat sur le Referer quand Origin est absent", () => {
    expect(() =>
      assertSameOrigin(mutation({ referer: `${APP_ORIGIN}/login?callbackUrl=/seats` })),
    ).not.toThrow();
  });

  it("accepte l'hôte réellement servi, derrière un proxy", () => {
    expect(() =>
      assertSameOrigin(
        mutation({
          origin: "https://admin.travelas.example",
          host: "admin.travelas.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).not.toThrow();
  });

  it("refuse une origine tierce", () => {
    expect(() =>
      assertSameOrigin(mutation({ origin: "https://evil.example" })),
    ).toThrow(CsrfError);
  });

  // Un formulaire cross-site posté sans en-tête ne doit pas être traité comme
  // légitime : en l'absence de preuve d'origine, on refuse.
  it("refuse une requête sans Origin ni Referer", () => {
    expect(() => assertSameOrigin(mutation({}))).toThrow(CsrfError);
  });

  it("refuse un Origin non analysable", () => {
    expect(() => assertSameOrigin(mutation({ origin: "pas-une-url" }))).toThrow(
      CsrfError,
    );
  });

  it("distingue le protocole et le port", () => {
    expect(() =>
      assertSameOrigin(mutation({ origin: "https://localhost:3000" })),
    ).toThrow(CsrfError);
    expect(() =>
      assertSameOrigin(mutation({ origin: "http://localhost:3001" })),
    ).toThrow(CsrfError);
  });

  it("expose un statut 403", () => {
    try {
      assertSameOrigin(mutation({ origin: "https://evil.example" }));
      expect.unreachable("aurait dû lever");
    } catch (error) {
      expect(error).toBeInstanceOf(CsrfError);
      expect((error as CsrfError).status).toBe(403);
    }
  });
});
