import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les réponses.
 * La `Content-Security-Policy` n'est PAS définie ici : elle est générée par
 * requête dans `src/middleware.ts` afin d'y injecter un nonce.
 */
const securityHeaders = [
  // Empêche le navigateur de deviner le type MIME (protection XSS via upload).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Aucune mise en iframe possible : protection contre le clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Ne fuite pas les URLs internes du dashboard vers des sites tiers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Désactive les APIs navigateur dont le dashboard n'a pas besoin.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Isolation cross-origin : limite les fuites de données entre origines.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // HSTS : ignoré en HTTP local, actif dès que le site est servi en HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Sortie autonome : `next build` produit un `server.js` et n'emporte que les
  // modules réellement atteints par le graphe de dépendances. C'est ce qui
  // permet à l'image Docker de se passer entièrement de `node_modules`.
  output: "standalone",

  // Ancre la racine Turbopack sur ce projet : le dossier parent contient
  // d'autres applications Next et leurs lockfiles.
  turbopack: { root: import.meta.dirname },

  // Ne pas divulguer la stack technique.
  poweredByHeader: false,

  // Le build DOIT échouer si le typage est cassé.
  // (Next 16 ne lance plus ESLint au build : le lint est un script à part,
  //  exécuté par `npm run verify` et par la CI.)
  typescript: { ignoreBuildErrors: false },

  // Les erreurs serveur ne doivent pas exposer le code source en production.
  productionBrowserSourceMaps: false,

  images: {
    // Uniquement les hôtes de confiance (stockage des logos/photos Travelas).
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },

  experimental: {
    serverActions: {
      // Le formulaire d'onboarding poste deux images en multipart, chacune
      // plafonnée à 2 Mo (`MAX_IMAGE_BYTES`, la limite du backend). Le budget
      // par défaut de Next est de 1 Mo pour *tout* le corps : un logo et une
      // bannière pourtant valides échouaient en 413 avant même d'atteindre la
      // Server Action — donc sans message de champ, sur la page d'erreur.
      // 5 Mo = 2 × 2 Mo + le nom et le surcoût d'encodage multipart.
      bodySizeLimit: "5mb",
    },
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

/**
 * next-intl est utilisé **sans routage par langue** : aucun segment `/fr` ou
 * `/en` dans les URLs, la langue est résolue par cookie dans
 * `src/i18n/request.ts`.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
