import { fileURLToPath } from "node:url";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Pas de `@vitejs/plugin-react` : il n'apporte que le Fast Refresh, inutile en
 * test, et il embarque sa propre version majeure de Vite — deux copies dans
 * l'arbre, et `tsc` refuse alors la configuration. Le JSX est compilé par
 * esbuild d'après `jsx: "react-jsx"` du tsconfig.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],

  resolve: {
    alias: {
      // `server-only` lève volontairement une exception dès qu'il est importé
      // hors d'un contexte serveur React. C'est exactement ce qu'on veut en
      // production, et exactement ce qui empêche de tester `lib/auth`,
      // `lib/security` ou `lib/api` : on le neutralise ici, et seulement ici.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
      // Même logique pour les APIs serveur de next-intl : hors rendu React
      // serveur, elles se résolvent sur une variante client qui lève, et elles
      // liraient de toute façon des cookies et en-têtes absents en test.
      "next-intl/server": fileURLToPath(
        new URL("./test/stubs/next-intl-server.ts", import.meta.url),
      ),
    },
  },

  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Les modules de configuration valident leur environnement au chargement :
    // sans ces valeurs, l'import de `lib/config/env` échoue avant le test.
    env: {
      API_URL: "http://localhost:3001",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_NAME: "Travelas Entreprise",
    },
  },
});
