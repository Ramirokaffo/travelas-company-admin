# CLAUDE.md

Guide de travail pour ce dépôt. À lire avant toute modification.

## Le projet en une phrase

Dashboard Next.js (App Router) destiné aux **chefs d'entreprise de transport**
partenaires de Travelas. Un seul rôle backend y a accès : `company_admin`.

Applications sœurs (mêmes conventions, même backend) :

| Chemin | Rôle |
|---|---|
| `/home/ubuntu/Bureau/Projets/Nest-project/travelas-backend` | API NestJS + TypeORM + MySQL (source de vérité) |
| `/home/ubuntu/Bureau/Projets/Next-projects/travelas-super-admin` | Dashboard `super_admin` |
| `/home/ubuntu/StudioProjects/travelas-mobile-agence` | Application mobile des agences |

## Commandes

```bash
npm run dev        # serveur de développement (port 3000)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run test       # Vitest (une passe) — `npm run test:watch` en développement
npm run build      # build de production
npm run verify     # typecheck + lint + test + build — à lancer avant de livrer
npm run format     # Prettier
```

Les tests sont colocalisés (`src/**/*.test.ts[x]`). Deux contraintes de
l'environnement de test, à ne pas « corriger » sans raison :

- `vitest.config.mts` **aliase `server-only` vers un module vide**. Sans cela,
  aucun module de `lib/api`, `lib/auth` ou `lib/security` n'est importable
  depuis un test.
- Il **aliase aussi `next-intl/server`** vers `test/stubs/next-intl-server.ts` :
  hors rendu React serveur, le vrai module se résout sur sa variante client et
  lève, et il lirait de toute façon des cookies absents en test. Le stub charge
  le **vrai catalogue français** — les assertions portent donc sur les textes
  réellement affichés.
- Un composant client qui appelle `useTranslations()` a besoin d'un provider :
  importer `render` depuis **`@test/intl`** au lieu de
  `@testing-library/react`.
- `jsdom` est **volontairement figé en v26** : la v30 tire une dépendance ESM
  que `require()` ne peut pas charger sous Node 20.15. `test/setup.ts` complète
  par ailleurs l'API `<dialog>`, absente de jsdom, dont dépend `ui/modal`.

Le backend doit tourner en parallèle sur `http://localhost:3001`
(`cd ../../Nest-project/travelas-backend && npm run start:dev`).

**Toute modification de `next.config.ts` exige un redémarrage franc de
`npm run dev`**, pas un simple rechargement. Le plugin next-intl y installe un
alias Turbopack (`next-intl/config`) qui n'est posé qu'au démarrage du
processus : un serveur lancé avant la modification échoue à l'exécution sur
« Couldn't find next-intl config file », alors même que `npm run build` passe.

## Vocabulaire métier — piège principal

| Terme métier | Entité backend | Attention |
|---|---|---|
| Entreprise | `CompanyEntity` (`company`) | Le locataire. |
| **Agence** | **`SeatEntity` (`seat`)** | Le backend l'appelle « siège ». |
| Ville / gare | `AgencyEntity` (`agency`) | ⚠️ **N'est pas** une agence d'entreprise : c'est un point géographique rattaché à une `city`, partagé entre entreprises. |
| Trajet | `CompanyJourneyEntity` | Appartient à un `seat`. |

Dans ce dépôt, `seat` signifie **toujours** « agence de l'entreprise ». Ne
jamais utiliser `agency` pour désigner une agence métier.

Rôles backend (`src/enum/user-role.enum.ts`) : `super_admin`, `company_admin`,
`agency_admin` (chef d'agence), `company_agent`, `company_driver`, `user`.
Le miroir côté front est `src/constants/roles.ts` — **les deux doivent rester
synchronisés**.

## Architecture

```
src/
  app/
    (public)/          pages sans session (login, register)
    (onboarding)/      création de l'entreprise — session mais pas d'entreprise
    (dashboard)/       pages protégées — layout appelle requireSession()
                       (dont `/settings` — réglages du **compte**, à ne pas
                       confondre avec `/company`, réglages de l'entreprise)
    api/auth/          route handlers BFF (login, logout, register,
                       verify-email, resend-verification, change-email,
                       forgot-password/{,verify,reset})
    api/exports/       route handlers produisant un fichier (CSV des recettes)
  components/ui|layout/  primitives et chrome de l'application
  components/charts/     graphiques (Recharts côté client, barres en pur CSS)
  features/<domaine>/    api.ts (serveur) · schemas.ts · actions.ts · components/
  i18n/
    config.ts  langues, cookie, négociation Accept-Language
    request.ts getRequestConfig (résolution par requête)
    messages/  fr.json · en.json
  lib/
    api/     server-api.ts (client HTTP serveur) · errors.ts
    auth/    session.ts (gardes) · cookies.ts · scope.ts (portée d'écriture)
    security/ csp.ts · origin.ts · rate-limit.ts
    config/  env.ts (serveur, validé Zod) · public-env.ts
    theme/   theme.ts (contrat) · theme-context.tsx (bascule client)
    layout/  sidebar-state.ts (barre latérale pliée / dépliée)
    i18n/    message.ts (traduction des clés renvoyées par les schémas/actions)
  constants/  roles.ts · routes.ts · auth-status.ts
  types/      schémas Zod des entités backend
  proxy.ts    ex-middleware (renommé dans Next 16)
```

## Langue et thème

Toute l'interface est bilingue **français / anglais**, et disponible en thème
**clair / sombre / système**. Ces réglages — comme le pliage de la barre
latérale — suivent le même principe : ils vivent dans un cookie **lisible par
JavaScript**, relu côté serveur au rendu.

Ce n'est pas une entorse à la règle 3 ci-dessous : une préférence d'affichage
n'est pas un secret. L'écriture côté client rend la bascule instantanée, et la
relecture serveur fait partir le HTML déjà dans la bonne langue et le bon
thème — sans script de pré-hydratation, qui devrait sinon passer par le nonce
CSP.

| Réglage | Cookie | Résolution |
|---|---|---|
| Langue | `travelas_locale` | cookie → `Accept-Language` → `fr` |
| Thème | `travelas_theme` | cookie → `system` |
| Barre latérale | `travelas_sidebar` | cookie → `expanded` |

### Internationalisation

- **Pas de routage par langue.** Aucun segment `/fr` ou `/en` : les URLs sont
  inchangées, `proxy.ts` et `ROUTES` n'ont rien à en connaître. Le dashboard
  est en `noindex`, le SEO multilingue n'apporterait rien.
- **Aucun texte d'interface en dur.** Composant serveur :
  `getTranslations("espace")`. Composant client : `useTranslations("espace")`.
- **Les modules partagés émettent des clés, jamais du texte.** Un schéma Zod
  (`staffFormSchema`) et une Server Action traversent la frontière
  client/serveur et n'ont pas accès à un traducteur lié à la requête. Ils
  renvoient donc des clés qualifiées (`validation.emailInvalid`,
  `staff.actions.created`), traduites à l'affichage par
  `useTranslatedMessage()`. Un message venu du backend traverse cette fonction
  sans dommage — il n'est simplement pas traduisible.
- **Les libellés de rôle et de statut n'ont pas de table de correspondance** :
  la valeur brute est déjà la clé (`roles.company_admin`,
  `auth.status.wrong_password`).
- **Toute clé ajoutée doit l'être dans les deux catalogues.**
  `src/i18n/messages.test.ts` compare les jeux de clés *et* les variables ICU :
  un oubli fait échouer les tests plutôt que d'afficher un chemin de clé à
  l'utilisateur.
- Une année ou tout nombre à ne pas formater se passe **en chaîne** :
  `{ year: String(...) }`. En ICU, `{year}` sur un nombre donne « 2 026 ».
- **Pas de pluriel ICU dans les catalogues.** Le test de parité extrait les
  variables par `\{(\w+)` : les mots d'une branche `=0 {aucun billet}` y
  ressemblent à des variables, et la comparaison FR/EN échoue. Les libellés
  comptés sont donc formulés sans pluriel (« Billets : {count} »).

### Montants et dates

- La monnaie et les formats de date sont déclarés **une seule fois**, dans
  `APP_CURRENCY` / `APP_FORMATS` (`i18n/config.ts`), et passés à next-intl par
  `i18n/request.ts`. On écrit `format.number(x, "currency")`, jamais la monnaie
  à la main : `XAF` n'a pas de sous-unité, `Intl` le sait, un formatage
  générique afficherait « 12 500,00 FCFA ».
- `NextIntlClientProvider` hérite ces formats du serveur sans qu'on ait à les
  lui passer. En test, en revanche, il faut les fournir : `test/intl.tsx` et le
  stub `test/stubs/next-intl-server.ts` le font.
- Toute date affichée passe par `format.dateTime(date, "…")` : le fuseau
  d'affichage (`APP_TIME_ZONE`) y est appliqué. Un `toLocaleString()` sans
  fuseau explicite afficherait l'heure du navigateur et divergerait du rendu
  serveur (avertissement d'hydratation).

### Thème

- Trois états, pas deux : `light`, `dark`, `system` — et `system` est le
  défaut. Le sélecteur est un `radiogroup` à trois options
  (`components/layout/theme-toggle.tsx`).
- **`system` ne pose aucune classe sur `<html>`.** C'est cette absence qui rend
  la main à `prefers-color-scheme`. Toute la mécanique en dépend :
  `themeClassName()`, le `@custom-variant dark` de `globals.css` et les jetons
  `light-dark()`. Ne pas y poser de classe « par cohérence ».
- Les jetons de couleur sont déclarés **une seule fois**, via `light-dark()`
  piloté par `color-scheme` — qui habille au passage les éléments natifs
  (champs, listes déroulantes, barres de défilement).
- **Le fond sombre n'est pas le bleu nuit de la marque.** `secondary-900`
  (#0a0b2e) est une couleur d'**accent** : étalée sur tout un écran
  d'administration, elle fatigue l'œil et fait vibrer le texte. Les surfaces
  sombres sont donc des gris quasi noirs, à peine bleutés — `#0b0c11` pour le
  fond, `#14151c` pour les cartes. Ne pas les « remettre à la charte » :
  l'identité est portée par l'orange, pas par le fond.
- **Séries de graphiques : `--chart-1` à `--chart-3`.** Attribuées dans un ordre
  fixe, par grandeur mesurée (recette, frais, passagers) et jamais par rang dans
  un classement — un filtre qui change le nombre de séries ne doit pas repeindre
  les survivantes. Les valeurs ne se choisissent pas à l'œil : elles sont
  vérifiées par le validateur de la compétence `dataviz` sur les deux surfaces
  réelles (bande de clarté OKLCH, chroma, séparation daltonienne ΔE ≥ 8,
  contraste ≥ 3:1). `brand-500` échoue la bande sombre — d'où `brand-600` en
  `--chart-1`.
- Un composant rendu hors de l'arbre CSS de la page (Sonner) ne voit pas la
  classe `.dark` : il faut lui passer le thème explicitement.
- `app/global-error.tsx` remplace tout le document et n'a donc **ni provider
  i18n ni layout**. Il relit les deux cookies lui-même et importe les
  catalogues statiquement. C'est le seul endroit où c'est légitime.

## Règles de sécurité — non négociables

Ce dashboard donne accès à des données financières et nominatives
multi-entreprises. Les règles suivantes ne se contournent pas « juste pour
tester » :

1. **Pattern BFF.** Le navigateur ne parle jamais directement à l'API NestJS.
   Toute communication passe par `lib/api/server-api.ts`, appelé depuis un
   Server Component, une Server Action ou un route handler.
2. **`API_URL` n'est jamais préfixé `NEXT_PUBLIC_`.** Ce préfixe inline la
   valeur dans le bundle navigateur. Aucun secret dans `NEXT_PUBLIC_*`.
3. **Les tokens vivent dans des cookies `httpOnly`.** Jamais de token dans
   `localStorage`, `sessionStorage` ou un cookie lisible par JavaScript, ni
   dans une prop de composant client.
4. **Toute page, tout layout et toute Server Action appelle `requireSession()`**
   (ou `requireCompanySession()`). Un layout parent ne protège pas une Server
   Action : c'est un point d'entrée HTTP indépendant.
5. **Toute mutation via route handler appelle `assertSameOrigin(request)`.**
6. **Toute réponse backend est validée par un schéma Zod** (`apiFetch`).
   Jamais de `as SomeType` sur une donnée réseau.
7. **Ne jamais renvoyer une entité backend brute au client.** Projeter d'abord
   (`toSessionUser`) : les entités contiennent `password`, `salt`,
   `firebaseId`, `notificationId`.
8. **Masquer un bouton n'est pas un contrôle d'accès.** L'autorisation réelle
   appartient au backend ; `src/proxy.ts` ne fait qu'un contrôle de présence de
   cookie. `canWriteOnSeat()` (`lib/auth/scope.ts`) relève de cette catégorie :
   il pilote l'affichage de la fiche d'agence, il ne protège rien.
9. **Ne jamais journaliser** un mot de passe, un token ou une entité
   utilisateur complète.

## Particularités du backend à connaître

- **Pagination** : `?page=&count=&withCount=`. `page` est **0-indexé**, et la
  forme des réponses varie d'un endpoint à l'autre (tableau nu, tuple
  `[items, total]`, objet `{ users, total }`) ; les endpoints `getMyCompany*`
  ne renvoient aucun total. Ne pas traiter ces cas à la main : passer par
  `src/lib/api/data-table.ts` (`parseTableQuery` → `toBackendQuery` →
  `paginatedSchema` → `toPageMeta`), seul endroit où la conversion d'index a
  lieu. Le tri y est filtré par liste blanche (`sortableColumns`) car la valeur
  finit en `orderBy` dans une requête SQL.
- **`GET /seat/getMyCompanySeat` ne sait que paginer** : ses deux paramètres
  sont des `@Query(ParseIntPipe)`, sans DTO — donc ni `search`, ni `orderBy`,
  ni `withCount`. La liste `/seats` charge une fenêtre bornée
  (`SEAT_WINDOW = 200`, avec détection de troncature) et applique recherche,
  tri et pagination en mémoire dans `features/seats/list.ts`.
- **Un identifiant d'agence venu de l'URL ne se relaie jamais tel quel.** Deux
  endpoints seulement le valident eux-mêmes (`GET /seat/:seatId` et
  `/daily-recipe/*`, via `assertSeatBelongsToUser` / `assertSameCompany`). Les
  autres se contentent d'ajouter un filtre. La règle appliquée dans
  `/seats/[id]` : charger l'agence **d'abord** (403/404 → `notFound()`), puis
  ses données rattachées — jamais les deux en parallèle.
- **Toute réponse d'écriture d'entreprise est du multipart.** `POST /company` et
  `PATCH /company/:id` montent un `FileFieldsInterceptor` : le corps est un
  `FormData`, et les booléens d'`UpdateCompanyDto` sont validés en
  `@IsBooleanString()` — donc `"true"` / `"false"`, pas `true` / `false`.
  `requiredFee`, `feePercent` et `isActive` relèvent d'`AdminUpdateCompanyDto` :
  les envoyer produit une 400.
- **Login** : `POST /auth/login` renvoie **200** avec un champ `status` même en
  cas d'échec métier (`wrong_password`, `need_password_update`…), et lève une
  **403** pour un compte bloqué. Les deux chemins sont traités dans
  `app/api/auth/login/route.ts`. Le mot de passe est vérifié **avant** le statut
  de vérification du compte (§6 sexies de PLAN.md) : `account_not_verified`
  prouve donc que l'appelant est le titulaire, et s'accompagne de `userId` +
  `email`. Le route handler s'en sert pour reposer le cookie d'inscription en
  attente et proposer « Terminer la vérification » — sans quoi un compte non
  vérifié est une impasse définitive.
- **Inscription** : `POST /auth/create` force `role = company_admin`
  (`auth.service.ts`) — ne jamais envoyer de champ `role`, `UserSubscribeDto`
  est soumis à `forbidNonWhitelisted`. La réponse contient l'**entité complète**
  du compte créé, hash et sel compris : le schéma Zod la referme à `id` +
  `email`. Les doublons arrivent en 400 avec le code métier **imbriqué**
  (`{ response: { status: "duplicate email" } }`), l'exception étant ré-emballée
  par le `catch` du service — un niveau plus bas que sur `POST /user/create`.
- **Vérification d'e-mail** : code à six chiffres valable **5 minutes**,
  `POST /auth/email { token, userId }` renvoie `AuthStatusEnum` (`"Yes"` =
  succès). Le compte visé n'est jamais transmis par le navigateur : il vit dans
  un cookie `httpOnly` (`lib/auth/pending-registration.ts`).
  `POST /auth/updateUnverifyEmail` exige `{ userId, oldEmail, newEmail }` : la
  route est ouverte, seul cet UUID prouve qu'on est à l'origine de l'inscription
  (chantier H, §6 quater de PLAN.md).
- **Fuseaux horaires : la base est en UTC.** Le pilote MySQL est en
  `timezone: "Z"` — **ne pas le remettre à `"+01:00"`**. Ce réglage ne dit pas
  « l'application est utilisée au Cameroun », il dit dans quel fuseau lire et
  écrire les `datetime` : avec `+01:00`, les colonnes remplies par MySQL
  (`createAt`, `updateAt`) se relisaient une heure trop tôt — tout code de
  vérification naissait expiré — et `travelDate >= NOW()` comparait l'heure de
  Douala à de l'UTC. L'heure du Cameroun est une affaire d'**affichage** :
  `APP_TIME_ZONE` (`Africa/Douala`) dans `i18n/config.ts`, jamais un
  `toLocaleString()` sans fuseau explicite. Voir le §6 quinquies de
  [PLAN.md](PLAN.md), et `scripts/migrate-timezone-utc.js` côté backend pour
  recaler une base qui aurait été écrite sous l'ancien réglage.
- **Changer l'adresse e-mail d'un compte vérifié se prouve** (§6 octies de
  PLAN.md). `PATCH /user { email }` et `POST /auth/profile { email }` **refusent**
  désormais une adresse différente de l'actuelle : ils ne vérifiaient que
  l'unicité, jamais la possession, et `isEmailVerify` restant à `true` le compte
  ressortait « vérifié » sur une boîte que personne n'avait prouvée — de quoi
  détourner la récupération du mot de passe. Le parcours est en deux temps :
  `POST /auth/requestEmailChange { currentPassword, newEmail }` range l'adresse
  dans **`pendingEmail`** et lui envoie un code ; `POST /auth/confirmEmailChange
  { token }` l'installe. `email` ne bouge pas entre les deux : le compte reste
  utilisable, et une faute de frappe ne coûte qu'une seconde demande
  (`POST /auth/cancelEmailChange` pour abandonner).
- **Photo de profil : `POST /auth/profile/image`, champ `image`** — et non
  `file` comme sur `PATCH /user`. Les deux routes montent des `FileInterceptor`
  de noms différents, un champ mal nommé est ignoré en silence. Elle valide les
  types avec `/^image\/(jpeg|jpg|ico|png)$/i` : **pas de WebP**, d'où
  `<ImageCropper allowWebp={false}>`. Retrait par
  `POST /auth/profile/image/delete` (`POST`, pas `DELETE`).
- **`PATCH /user` (sans identifiant) met à jour le compte de l'appelant.**
  Préférer cette route à `PATCH /user/:id` pour son propre profil : la cible ne
  se choisit pas. `role`, `isBlocked`, `isActive`, `isEmailVerify`,
  `isPhoneVerify`, `seatId` et `permission` sont les `SELF_PROTECTED_FIELDS` —
  les envoyer sur son propre compte produit une 400.
- **Mot de passe oublié** : même code, même endpoint, avec `?reauth=true` — ce
  drapeau autorise l'envoi à un compte **déjà vérifié** et fait délivrer un
  `reset_token` (JWT de 30 min) par `POST /auth/email?reauth=true`. En mode
  `reauth`, le backend cherche le code **sans identifiant de compte** : ne lui
  passer que `token`. Le jeton reste dans un cookie `httpOnly`
  (`lib/auth/password-reset.ts`) et sert de Bearer à `POST /auth/resetPassword`.
  La réponse de `/api/auth/forgot-password` est identique que le compte existe
  ou non — ne jamais relayer la 400 du backend, elle permettrait d'énumérer les
  comptes.
- **Entreprise** : `POST /company` attend du **multipart** (`logo`, `banner`) et
  `CreateCompanyDto` ne porte que `name`. Un compte = une entreprise : une
  seconde création lève une 401 « Already have company » — sans ce contrôle,
  elle orphelinerait la première avec ses agences et ses recettes.
- **Le backend accepte plusieurs rôles au login.** Le cloisonnement de ce
  dashboard est fait côté front : `isAllowedDashboardRole()` dans le route
  handler *et* dans `getSession()`.
- **Déconnexion** : `GET /auth/logOut` positionne `isLoggedOut = true` ; la
  `JwtStrategy` rejette alors le token même s'il n'a pas expiré.
- **Durée de vie des tokens** : 30 jours (access) / 60 jours (refresh). C'est
  excessif et corrigé au chantier A de [PLAN.md](PLAN.md).
- Les endpoints `company_admin` utiles sont préfixés `getMyCompany*` ou
  `myCompany` (`/user/getMyCompanyUsers`, `/seat/getMyCompanySeat`,
  `/ticket/getMyCompanyTickets`, `/company-journey/getMyCompanyJourneys`,
  `/opinion/myCompany`, et — ajoutés avec les phases 4 et 5 —
  `/daily-recipe/myCompany` et `/issue/myCompany`).
- **Chaque liste a son propre dialecte de filtres.** Le `ValidationPipe` global
  étant en `forbidNonWhitelisted`, un paramètre absent du DTO ne dégrade pas la
  requête : il la fait échouer en **400**. D'où l'interdiction d'appliquer
  `toBackendQuery()` partout. Le tableau à connaître avant d'écrire un `api.ts` :

  | Endpoint | `search` | Tri | Drapeaux | `page` |
  |---|---|---|---|---|
  | `/user/getMyCompanyUsers` | oui | **non** (`UserFilterDto` n'a ni `orderBy` ni `order`) | booléens | 0-indexé |
  | `/seat/getMyCompanySeat` | **non** | **non** | aucun | 0-indexé |
  | `/company-journey/getMyCompanyJourneys` | **non** | `CompanyJourneyFilterEnum` | booléens | 0-indexé |
  | `/ticket/getMyCompanyTickets` | oui | **non** (l'enum ne vise que le trajet) | **`"0"`/`"1"`** | 0-indexé |
  | `/opinion/myCompany` | oui | **non** | booléens | 0-indexé |
  | `/issue/myCompany` | oui | **non** | booléens | 0-indexé |
  | `/daily-recipe/myCompany` | **non** | **non** | booléens | 0-indexé |
  | `/speed-issue` | oui | **non** | — | ⚠️ **1-indexé** |

  `/speed-issue` est la seule exception à la pagination 0-indexée
  (`skip: (page - 1) * count`) : la conversion est confinée à
  `features/incidents/api.ts`.
- **Les réponses des statistiques sont enveloppées** dans
  `{ success: true, data: … }`, et leurs agrégats arrivent tantôt en nombre,
  tantôt en chaîne (`SUM()` d'une colonne `float`), tantôt à `null` (aucune
  ligne). `features/analytics/schemas.ts` déballe et normalise les trois cas —
  ne pas lire ces réponses sans passer par lui.
- **Le module `statistics` reste fragile.** Chaque lecture y est enveloppée dans
  un helper tolérant (`features/analytics/api.ts`) : un widget qui ne se calcule
  pas disparaît au lieu de faire tomber la page. Une 401/403 continue de
  remonter — c'est un vrai problème de session.
- **`ValidationPipe` est global avec `whitelist` + `forbidNonWhitelisted`** : un
  paramètre ou un champ absent du DTO ne dégrade pas la requête, il la fait
  échouer en **400**. Avant d'ajouter un paramètre, vérifier qu'il figure bien
  dans le DTO visé. Conséquence concrète : `UserFilterDto` n'expose ni `orderBy`
  ni `order`, donc **les listes de personnel ne se trient pas**.
- **`user-permission` est un squelette généré par le CLI Nest** : ses cinq
  routes existent, ses méthodes renvoient des chaînes et ne touchent pas la
  base. Ne rien construire dessus. Les permissions se pilotent par le champ
  imbriqué `permission` de `POST /user/create` et `PATCH /user/:id` ; le blocage
  d'un compte par `PATCH /user/:id { isBlocked }`.
- `POST /user/create` génère lui-même le mot de passe s'il est absent, l'envoie
  par e-mail et impose sa rotation. Le dashboard ne transmet donc jamais de mot
  de passe à la création d'un collaborateur.
- `@IsPhoneNumber()` est utilisé **sans région** : les numéros doivent porter
  leur indicatif international (`+225…`), sinon 400.

### Cloisonnement multi-entreprises (côté backend)

Le cloisonnement est assuré par `src/helpers/company-scope.helper.ts` :

- `assertSameCompany(user, resourceCompanyId)` — à appeler dans **tout** service
  qui charge une ressource par identifiant pour un `company_admin` ;
- `assertCanAssignRole(user, role)` — liste blanche des rôles créables ;
- `requireCompanyId(user)` — refuse une action tant que l'entreprise n'existe pas.

`RolesGuard` est **globale** (déclarée dans `auth.module.ts`, après
`JwtAuthGuard`) : un `@Roles()` est donc toujours appliqué, même sans
`@UseGuards(RolesGuard)`. Ne pas la re-déclarer dans `app.module.ts` — elle y
s'exécuterait avant l'authentification et refuserait tout en 403.

Après toute modification touchant aux rôles ou au périmètre des données :

```bash
node scripts/test-cloisonnement-entreprises.js   # 21 contrôles, backend démarré
```

Après toute modification touchant à l'adresse e-mail d'un compte :

```bash
node scripts/test-changement-email.js            # 24 contrôles, backend démarré
```

Son quota est **par IP** : deux exécutions à moins de dix minutes d'intervalle
se heurtent au throttler, pas à une régression — le script le signale.

Voir le §6 bis de [PLAN.md](PLAN.md) pour ce qui a été corrigé et pourquoi.

## Conventions de code

- **Server Components par défaut.** `"use client"` uniquement pour
  l'interactivité (formulaires, graphiques, menus).
- Lecture de données : Server Component + `apiFetch`.
  Écriture : Server Action ou route handler.
- Un dossier par domaine sous `src/features/`.
- Fichiers `kebab-case`, composants `PascalCase`, hooks `useXxx`.
- Textes d'interface : **jamais en dur**, toujours via les catalogues (voir
  « Langue et thème »). Le français reste la langue de référence — c'est celle
  qu'on rédige d'abord, et celle sur laquelle portent les tests.
- Commentaires et messages techniques (logs, erreurs internes) **en français**,
  identifiants de code en anglais sauf termes métier (`seat`, `company`).
- Classes Tailwind v4 ; les couleurs passent par les jetons de `globals.css`
  (`bg-surface`, `text-muted`, `border-subtle`, `bg-brand-500`). **Aucune
  couleur en dur dans un composant.**
- **Charte de la suite Travelas** (identique au dashboard super-admin) :
  orange `#FF7122` = `brand-500`, bleu nuit `#0A0B2E` = `secondary-900`. Deux
  contraintes de contraste qui expliquent les choix en place :
  `brand-500` ne porte que du texte `secondary-900` (l'orange vif sur blanc
  tombe à 2,5:1), et un texte orange sur fond clair utilise `brand-700`, pas
  `brand-600`.
- Les logos Travelas et Novatech passent par `components/ui/brand-logo.tsx`,
  qui gère seul les déclinaisons clair/sombre. Ne pas référencer les fichiers
  de `public/logo/` directement.
- Le thème sombre est piloté par la classe `.dark` sur `<html>`
  (`@custom-variant dark` dans `globals.css`), pas par `prefers-color-scheme`.
  Aucune bascule n'est encore branchée : les jetons sombres sont prêts, l'UI
  reste en clair.
- ESLint interdit aux composants client d'importer `lib/api/server-api`,
  `lib/config/env` et `lib/auth/cookies`. Si la règle se déclenche, c'est un
  problème d'architecture, pas une règle à désactiver.

## Modifier le backend

C'est autorisé et souvent nécessaire. Dans ce cas :

1. Respecter les conventions NestJS existantes (module / controller / service /
   dto / entities, `@Roles` + `RolesGuard`).
2. `JwtAuthGuard` est global (`APP_GUARD` dans `auth.module.ts`) ; utiliser
   `@SkipAuth()` pour ouvrir une route — avec prudence.
3. Toujours cadrer les données sur `user.company.id` pour un `company_admin`.
4. Mettre à jour les schémas Zod correspondants dans `src/types/` de ce dépôt.

## Avant de livrer

```bash
npm run verify
```

Puis relire la checklist du §8 de [PLAN.md](PLAN.md) si le changement touche à
l'authentification, aux cookies, aux en-têtes ou au périmètre des données.
