import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, mediaOrigin } from "./csp";

/**
 * La CSP est une protection silencieuse : quand elle est trop large personne
 * ne s'en aperçoit, et quand elle est trop étroite l'image disparaît sans
 * erreur réseau. Les deux bords sont donc assurés ici.
 */

function directive(csp: string, name: string): string {
  const found = csp
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ?? "";
}

const build = (mediaOrigin?: string | null) =>
  buildContentSecurityPolicy({ nonce: "abc123", isDev: false, mediaOrigin });

describe("mediaOrigin", () => {
  it("ne retient que l'origine de l'API", () => {
    expect(mediaOrigin("http://localhost:3001")).toBe("http://localhost:3001");
    // Le chemin de l'API n'a rien à faire dans un en-tête public.
    expect(mediaOrigin("https://api.travelas.app/v1")).toBe("https://api.travelas.app");
  });

  it("retombe sur null plutôt que d'injecter une valeur douteuse", () => {
    expect(mediaOrigin(undefined)).toBeNull();
    expect(mediaOrigin("pas une url")).toBeNull();
  });
});

describe("buildContentSecurityPolicy", () => {
  // Le backend sert lui-même les logos sous `/files/images/…`.
  it("autorise les images servies par le backend", () => {
    expect(directive(build("http://localhost:3001"), "img-src")).toContain(
      "http://localhost:3001",
    );
  });

  // Ouvrir `img-src` ne doit pas ouvrir le canal de données : le navigateur ne
  // parle jamais directement à l'API NestJS (pattern BFF).
  it("n'ouvre pas connect-src vers le backend", () => {
    const csp = build("http://localhost:3001");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
  });

  it("reste valide sans origine de médias", () => {
    const csp = build(null);
    expect(directive(csp, "img-src")).toBe(
      "img-src 'self' data: blob: https://storage.googleapis.com https://firebasestorage.googleapis.com",
    );
  });

  it("porte le nonce et n'autorise aucun script inline", () => {
    const csp = build(null);
    expect(directive(csp, "script-src")).toContain("'nonce-abc123'");
    expect(csp).not.toContain("'unsafe-inline'; script");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
  });
});
