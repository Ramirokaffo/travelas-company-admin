import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, mediaOrigins, socketOrigins } from "./csp";

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

const build = (media?: string) =>
  buildContentSecurityPolicy({
    nonce: "abc123",
    isDev: false,
    mediaOrigins: mediaOrigins(media),
  });

describe("mediaOrigins", () => {
  it("ne retient que l'origine des URLs fournies", () => {
    expect(mediaOrigins("http://localhost:3001")).toEqual(["http://localhost:3001"]);
    // Le chemin de l'API n'a rien à faire dans un en-tête public.
    expect(mediaOrigins("https://api.travelas.app/v1")).toEqual([
      "https://api.travelas.app",
    ]);
  });

  it("accepte plusieurs origines séparées par des virgules, sans doublon", () => {
    expect(mediaOrigins("https://api.travelas.app, https://cdn.travelas.app/x")).toEqual([
      "https://api.travelas.app",
      "https://cdn.travelas.app",
    ]);
    expect(mediaOrigins("https://api.travelas.app,https://api.travelas.app/files")).toEqual(
      ["https://api.travelas.app"],
    );
  });

  it("ignore une valeur douteuse plutôt que de l'injecter", () => {
    expect(mediaOrigins(undefined)).toEqual([]);
    expect(mediaOrigins("")).toEqual([]);
    expect(mediaOrigins("pas une url")).toEqual([]);
    // Une entrée invalide ne doit pas emporter les valides avec elle.
    expect(mediaOrigins("pas une url,https://api.travelas.app")).toEqual([
      "https://api.travelas.app",
    ]);
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
    const csp = build();
    expect(directive(csp, "img-src")).toBe(
      "img-src 'self' data: blob: https://storage.googleapis.com https://firebasestorage.googleapis.com",
    );
  });

  it("porte le nonce et n'autorise aucun script inline", () => {
    const csp = build();
    expect(directive(csp, "script-src")).toContain("'nonce-abc123'");
    expect(csp).not.toContain("'unsafe-inline'; script");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
  });
});

describe("socketOrigins", () => {
  it("ajoute le schéma WebSocket à l'origine HTTP", () => {
    // Un navigateur n'assimile pas `wss://h` à `https://h` : les deux formes
    // doivent figurer dans la politique, sinon le handshake passe et la
    // bascule WebSocket est bloquée.
    expect(socketOrigins("https://api.travelas.app")).toEqual([
      "https://api.travelas.app",
      "wss://api.travelas.app",
    ]);
    expect(socketOrigins("http://localhost:3001")).toEqual([
      "http://localhost:3001",
      "ws://localhost:3001",
    ]);
  });

  it("n'ouvre rien quand le temps réel est désactivé", () => {
    expect(socketOrigins(undefined)).toEqual([]);
    expect(socketOrigins("")).toEqual([]);
    expect(socketOrigins("pas une url")).toEqual([]);
  });
});

describe("connect-src et temps réel", () => {
  const buildWithSocket = (url?: string) =>
    buildContentSecurityPolicy({
      nonce: "abc123",
      isDev: false,
      mediaOrigins: ["http://localhost:3001"],
      socketOrigins: socketOrigins(url),
    });

  it("ouvre le seul point d'entrée socket, dans les deux schémas", () => {
    expect(directive(buildWithSocket("http://localhost:3001"), "connect-src")).toBe(
      "connect-src 'self' http://localhost:3001 ws://localhost:3001",
    );
  });

  it("reste fermé quand aucune URL socket n'est configurée", () => {
    expect(directive(buildWithSocket(undefined), "connect-src")).toBe(
      "connect-src 'self'",
    );
  });
});
