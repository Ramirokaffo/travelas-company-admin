# Travelas Company Admin

Dashboard d'administration des **entreprises de transport** partenaires de
Travelas. Réservé au rôle backend `company_admin` (chef d'entreprise).

## Démarrage

```bash
cp .env.example .env.local   # puis renseigner API_URL
npm install
npm run dev                  # http://localhost:3000
```

Le backend NestJS doit tourner en parallèle :

```bash
cd ../../Nest-project/travelas-backend && npm run start:dev   # port 3001
```

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify` | typecheck + lint + build |
| `npm run format` | Prettier |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 ·
Zod · TanStack Query · React Hook Form · Recharts.

## Sécurité

L'application suit un pattern **BFF** : le navigateur ne communique jamais
directement avec l'API NestJS. Les tokens sont conservés dans des cookies
`httpOnly` / `Secure` / `SameSite=Lax`, une CSP à nonce est générée par
requête, et toutes les mutations vérifient l'origine de la requête.

Les règles détaillées sont dans [CLAUDE.md](CLAUDE.md) ; la feuille de route et
les correctifs backend requis dans [PLAN.md](PLAN.md).
