import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // Une variable inutilisée est souvent un oubli de branchement.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `any` désactive silencieusement le typage des réponses backend.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  {
    // Garde-fou d'architecture : le code client ne doit jamais importer
    // directement la couche serveur (secrets, tokens, URL de l'API).
    files: ["src/components/**", "src/features/**/components/**", "src/hooks/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/api/server-api", "@/lib/config/env", "@/lib/auth/cookies"],
              message:
                "Couche serveur uniquement. Passez par une Server Action ou un route handler sous /api.",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
