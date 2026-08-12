import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clientKey, rateLimit } from "./rate-limit";

const OPTIONS = { limit: 3, windowMs: 60_000 };

/**
 * L'état du limiteur est global au module (une `Map`). Chaque test utilise donc
 * une clé distincte : sans cela, un test consommerait le quota du suivant.
 */
let keyCounter = 0;
const nextKey = () => `test:${keyCounter++}`;

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("autorise les requêtes jusqu'à la limite incluse", () => {
    const key = nextKey();
    expect(rateLimit(key, OPTIONS)).toMatchObject({ allowed: true, remaining: 2 });
    expect(rateLimit(key, OPTIONS)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rateLimit(key, OPTIONS)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("refuse au-delà de la limite et indique le délai d'attente", () => {
    const key = nextKey();
    for (let i = 0; i < OPTIONS.limit; i += 1) rateLimit(key, OPTIONS);

    const blocked = rateLimit(key, OPTIONS);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("réinitialise le quota une fois la fenêtre écoulée", () => {
    const key = nextKey();
    for (let i = 0; i < OPTIONS.limit; i += 1) rateLimit(key, OPTIONS);
    expect(rateLimit(key, OPTIONS).allowed).toBe(false);

    vi.advanceTimersByTime(OPTIONS.windowMs + 1);

    expect(rateLimit(key, OPTIONS)).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("cloisonne les quotas par clé", () => {
    const attacker = nextKey();
    const bystander = nextKey();

    for (let i = 0; i < OPTIONS.limit + 5; i += 1) rateLimit(attacker, OPTIONS);

    expect(rateLimit(attacker, OPTIONS).allowed).toBe(false);
    expect(rateLimit(bystander, OPTIONS).allowed).toBe(true);
  });
});

describe("clientKey", () => {
  const request = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/auth/login", { method: "POST", headers });

  it("retient la première adresse de x-forwarded-for", () => {
    expect(clientKey(request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
  });

  it("se rabat sur x-real-ip", () => {
    expect(clientKey(request({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("renvoie une clé commune quand l'IP est inconnue", () => {
    expect(clientKey(request({}))).toBe("unknown");
  });
});
