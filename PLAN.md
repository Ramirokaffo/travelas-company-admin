# Plan de développement — Travelas Company Admin

Dashboard d'administration destiné aux **chefs d'entreprise** de transport
(rôle backend `company_admin`).

> Ce document est le plan de référence. Il décrit ce qui est déjà livré, ce qui
> reste à construire, et — point important — les **modifications backend
> requises**, dont plusieurs correctifs de sécurité bloquants.

---

## 1. Périmètre fonctionnel

Le chef d'entreprise doit pouvoir :

1. **Créer son compte** puis **déclarer son entreprise**.
2. **Gérer son personnel** : chefs d'agence (`agency_admin`), agents
   (`company_agent`), chauffeurs (`company_driver`).
3. **Gérer ses agences** (entité backend `SeatEntity`, « siège ») et y
   **affecter des utilisateurs**.
4. **Piloter** : statistiques consolidées, chiffre d'affaires, incidents, avis.
5. **Observer toutes ses agences en lecture seule**, sauf celle à laquelle il
   est lui-même rattaché (`user.companySeat`) où il dispose des droits
   d'écriture.

### Vocabulaire (attention aux faux amis)

| Terme métier | Entité backend | Remarque |
|---|---|---|
| Entreprise | `CompanyEntity` (`company`) | Le locataire (tenant). |
| **Agence** | **`SeatEntity` (`seat`)** | Nommée « siège » côté backend. |
| Ville / gare | `AgencyEntity` (`agency`) | ⚠️ `agency` ≠ agence métier : c'est un **point géographique** rattaché à une `city`, partagé entre entreprises. |
| Trajet | `CompanyJourneyEntity` | Relie deux `agency`, appartient à un `seat`. |
| Recette du jour | `DailyRecipeEntity` | Base du chiffre d'affaires par agence. |

Cette ambiguïté est la principale source d'erreur du projet : dans le code du
dashboard, on utilise systématiquement **`seat` = agence de l'entreprise**.

---

## 2. Modèle d'autorisation retenu

Trois barrières, du moins fiable au plus fiable :

| Niveau | Fichier | Ce qu'il garantit |
|---|---|---|
| Navigation | `src/proxy.ts` | Présence d'un cookie de session. Redirection. **Aucune garantie de sécurité.** |
| Session | `src/lib/auth/session.ts` | Le compte existe, est actif, non bloqué, et son rôle est `company_admin`. Vérifié auprès du backend à chaque rendu. |
| Donnée | Backend NestJS | Le seul niveau qui puisse garantir qu'une ressource appartient bien à l'entreprise de l'appelant. |

**Règle non négociable** : toute page, tout layout et **toute Server Action**
appelle `requireSession()` ou `requireCompanySession()`. Un layout parent ne
protège pas une Server Action, qui est un point d'entrée HTTP à part entière.

### Portée « lecture seule » vs « écriture »

Le besoin « voir toutes les agences sans pouvoir modifier, sauf la sienne » se
traduit par un helper à écrire en phase 3 :

```ts
// src/lib/auth/scope.ts
export function canWriteOnSeat(session: SessionUser, seatId: string): boolean {
  // Pas de rattachement à une agence → lecture seule partout (pilotage global).
  if (!session.seat) return false;
  return session.seat.id === seatId;
}
```

Ce helper pilote l'affichage. **La même règle doit être appliquée côté
backend** (voir §6, chantier B) : sans cela, il ne s'agit que d'un masquage
d'interface, contournable par un simple appel HTTP.

---

## 3. État actuel — livré ✅

- Structure `src/` (app / features / components / lib / types / constants).
- TypeScript strict + `noUncheckedIndexedAccess`, `noUnusedLocals`.
- Validation des variables d'environnement au boot (`src/lib/config/env.ts`).
- **Pattern BFF** : le navigateur ne connaît ni l'URL ni le token de l'API.
  `API_URL` n'est **pas** préfixé `NEXT_PUBLIC_`.
- **Cookies `httpOnly` + `Secure` + `SameSite=Lax`** : une XSS ne peut pas
  voler la session.
- **CSP à nonce** générée par requête + en-têtes de sécurité
  (`X-Frame-Options: DENY`, `nosniff`, HSTS, `Permissions-Policy`, COOP/CORP).
- **Anti-CSRF** : vérification d'origine sur toutes les mutations.
- **Rate limiting** sur `/api/auth/login` (10 req/min/IP).
- Garde de rôle : seul `company_admin` obtient une session ici.
- Validation Zod des réponses backend (`apiFetch`), erreurs normalisées, timeout.
- Login / logout, shell dashboard (sidebar + topbar), pages d'erreur et 404.
- Garde-fou ESLint : le code client ne peut pas importer la couche serveur.
- **Phase 1** : kit de composants, `lib/api/data-table.ts`, frontières
  `error`/`loading` par segment, harnais de test Vitest.
- **Phases 2 à 5 livrées** : inscription et onboarding, entreprise, agences (avec
  fiche détaillée), personnel, pilotage (vue d'ensemble, statistiques, recettes
  et export CSV) et exploitation (trajets, billets, incidents, avis).
  **373 tests** au vert.

**Vérifié** : `npm run verify` (typecheck + lint + tests + build) passe ; la
redirection `/dashboard` → `/login`, le rejet CSRF (403), la validation (400) et
le rate limit (429) ont été testés en exécution puis figés en tests.

---

## 4. Phases à venir

Chaque phase se termine par : `npm run verify` au vert + revue de sécurité des
nouveaux points d'entrée.

### Phase 1 — Fondations restantes — **livrée** (hors rafraîchissement du token)

- [x] `src/lib/api/data-table.ts` : pagination/tri/filtre unifiés. Le backend
      utilise `?page=&count=&withCount=` (⚠️ `page` est **0-indexé**).
      La conversion 1-indexé → 0-indexé est confinée à `toBackendQuery()`.
      `paginatedSchema()` absorbe les **trois** formes de réponse paginée
      renvoyées par l'API (tableau nu, tuple `[items, total]` de `findAndCount`,
      objet `{ users, total }`) — et le fait que les endpoints `getMyCompany*`
      ne renvoient **aucun total**, d'où `total: number | null`.
      Le tri est filtré par liste blanche : la valeur finit en `orderBy` dans
      une requête SQL du backend.
- [x] Composants : `Card`, `Table`, `Badge`, `Modal`, `Select`, `EmptyState`,
      `Skeleton`, `Pagination`, `ConfirmDialog`. `Modal` s'appuie sur
      `<dialog>` natif (piège de focus, fond inerte, Échap — sans dépendance).
- [x] `error.tsx` / `loading.tsx` par segment, plus `app/global-error.tsx`
      pour les erreurs du layout racine.
- [ ] Rafraîchissement du token : route handler `/api/auth/refresh` appelant
      `GET /auth/refresh` (Bearer = refresh token), déclenché sur 401 depuis
      `apiFetch`. **Bloqué** : prérequis du chantier A du §6 (durée de vie des
      tokens). Sans rotation côté backend, un endpoint de refresh n'apporte
      rien — l'access token vit déjà 30 jours.
- [x] Vitest + Testing Library ; 87 tests sur `assertSameOrigin`, `rateLimit`,
      `clientKey`, `safeCallbackUrl`, `toSessionUser`/`userSchema`,
      `data-table`, la garde de rôle du login et les composants
      `Pagination` / `ConfirmDialog`. `npm run test`, intégré à `npm run verify`.

### Phase 2 — Inscription et onboarding — **livrée**

Le parcours complet **compte → vérification de l'e-mail → entreprise →
dashboard** est en place. Trois écrans, deux d'entre eux dans la même page.

- [x] `POST /api/auth/register` → `POST /auth/create`. Route handler et non
      Server Action : il faut poser un cookie et limiter le débit (5 créations /
      15 min / IP) avant qu'une session existe. La réponse du backend est
      l'**entité TypeORM complète** du compte créé — hash et sel compris : le
      schéma Zod de `user` y est volontairement fermé, il ne conserve que `id`
      et `email`.
- [x] Page `/register` : `registerSchema` complété (indicatif international
      obligatoire — `@IsPhoneNumber()` est utilisé sans région côté backend) et
      liste de contrôle du mot de passe cochée à la frappe.
- [x] Écran « vérifiez votre e-mail » : saisie du code à six chiffres
      (`POST /auth/email`), renvoi (`POST /auth/sendConfirmationEmail`, 3 / 10 min)
      et **correction de l'adresse** (`POST /auth/updateUnverifyEmail`) — sans
      cette dernière, une faute de frappe dans l'e-mail est sans issue : le
      compte existe déjà, donc se réinscrire échoue sur le doublon de téléphone.
- [x] L'identité du compte en cours de vérification vit dans un cookie
      `httpOnly` (`lib/auth/pending-registration.ts`), jamais dans le corps des
      réponses ni dans une prop de composant client. Recharger la page reprend
      donc à l'étape de vérification.
- [x] **Reprise de la vérification depuis la connexion.** Un compte créé mais
      jamais vérifié était une impasse : impossible de se connecter, impossible
      de se réinscrire (téléphone et identifiant déjà pris), et l'écran de
      vérification perdu dès qu'on le quittait. `POST /auth/login` accompagne
      désormais `account_not_verified` de l'identité du compte — **uniquement
      après validation du mot de passe** (voir §6 sexies) : le route handler
      repose le cookie d'inscription en attente, et le formulaire affiche un
      lien « Terminer la vérification de mon e-mail » vers `/register`, qui
      reprend à la saisie du code avec renvoi et correction d'adresse.
- [x] Session ouverte automatiquement après vérification, via le **même**
      `/api/auth/login` que le formulaire de connexion (un seul endroit où une
      session peut naître). Le mot de passe reste dans une `ref` le temps du
      parcours ; si la page a été rechargée, on bascule sur `/login?verified=1`.
- [x] Onboarding `/onboarding` → `POST /company` (nom, logo, bannière) en
      `FormData` via Server Action. Groupe de routes `(onboarding)` à part :
      la barre latérale du dashboard ne mènerait qu'à des pages qui renvoient
      ici. `CreateCompanyDto` ne porte que `name` — options de réservation et
      frais se règlent ensuite par `PATCH /company/:id` (phase 3).
- [x] Mot de passe oublié `/forgot-password` : adresse → code → nouveau mot de
      passe, trois étapes dans une page.
      - `POST /auth/sendConfirmationEmail?reauth=true` : c'est `reauth` qui
        autorise l'envoi à un compte **déjà vérifié**, et qui fera délivrer un
        jeton à la validation du code.
      - `POST /auth/email?reauth=true` renvoie un `reset_token` (JWT de 30 min)
        qui, à lui seul, autorise le changement de mot de passe : il est rangé
        dans un cookie `httpOnly` (`lib/auth/password-reset.ts`) et n'atteint
        jamais le navigateur. `POST /auth/resetPassword` le consomme en Bearer,
        puis le cookie est effacé.
      - **Anti-énumération** : la réponse est identique — corps et cookie
        compris — que le compte existe ou non. Le backend, lui, lève une 400
        pour une adresse inconnue ; la relayer ferait de ce formulaire un
        annuaire des entreprises partenaires. Une panne réelle (5xx) reste
        signalée.
      - Aucune session n'est ouverte au bout, contrairement à l'inscription :
        après un changement de mot de passe, se reconnecter est la règle, et
        cela évite de garder le nouveau mot de passe en mémoire.
      - `POST /auth/changePassword` (changement depuis un compte connecté) est
        branché sur `/settings` (phase 5 bis) — et non sur `/profile`, route
        qui n'a finalement pas de page : les réglages du compte tiennent en un
        seul écran.

### Phase 3 — Entreprise, agences, personnel (≈ 5 j)

- [x] `/company` — **livré** : fiche publique (bannière, logo, note moyenne,
      taux de commission de la plateforme en lecture seule) et réglages
      (`PATCH /company/:id`) — mode de réservation, réservation par numéro de
      place, signalement d'incidents, double authentification. La requête est du
      **multipart** et les booléens y partent en chaînes : `UpdateCompanyDto`
      les valide en `@IsBooleanString()`. `requiredFee`, `feePercent` et
      `isActive` appartiennent à `AdminUpdateCompanyDto` — les envoyer produit
      une 400, ce qui est le comportement souhaitable : le taux de la plateforme
      ne se négocie pas depuis ce dashboard.
- [x] `/seats` — **livré** : liste (`GET /seat/getMyCompanySeat`), création
      (`POST /seat`), édition (`PATCH /seat/:id`), activation/désactivation
      (`PATCH /seat/:id { isActive }`) et suppression logique
      (`DELETE /seat/:seatId`). La gare de rattachement (`AgencyEntity`, faux
      ami — c'est un point géographique) est choisie dans `GET /agency`,
      groupée par ville : `CreateSeatDto.agencyId` est `@IsNotEmpty()`.
- [ ] Limites connues de `/seats`, dues au backend :
      - **recherche, tri et pagination sont faits en mémoire**
        (`features/seats/list.ts`). `getMyCompanySeat` n'accepte que `page` et
        `count` — deux `ParseIntPipe`, sans DTO : ni `search`, ni `orderBy`, ni
        `withCount`, donc aucun total. La fenêtre chargée est plafonnée à 200
        agences et l'interface signale une troncature. À revoir le jour où le
        backend exposera un `SeatFilterDto` cadré entreprise ;
      - **rien n'impose l'unicité de l'agence principale** : `isMain` est un
        booléen libre, le formulaire se contente de le rappeler ;
      - les contacts sont désormais branchés (chantier G traité, §6 septies).
- [x] `/seats/[id]` — **livré** : équipe (`GET /user/getBySeatId/:seatId`),
      contacts (`/seat-contact`, chantier G levé), recettes des sept derniers
      jours, trajets et signalements récents. `canWriteOnSeat()`
      (`lib/auth/scope.ts`) y pilote l'affichage : hors agence de rattachement,
      la fiche est en lecture seule **et le dit**, plutôt que de faire
      disparaître les blocs sans explication. La configuration de l'agence
      (nom, activation, suppression) reste une opération d'entreprise, autorisée
      sur toutes les agences du locataire depuis `/seats`.
      ⚠️ L'identifiant vient de l'URL : la page charge l'agence **d'abord**
      (`GET /seat/:seatId`, qui refuse en 403 celle d'un concurrent), puis ses
      données rattachées. 403 et 404 tombent tous deux sur « introuvable » —
      les distinguer révélerait l'existence de l'agence.
- [x] `/staff` — **livré** : liste paginée et filtrée
      (`GET /user/getMyCompanyUsers`), création (`POST /user/create`), édition
      (`PATCH /user/:id`), suppression logique (`DELETE /user/:id`),
      affectation à une agence. Prérequis du chantier B : levé (§6 bis).
      À la création, aucun mot de passe ne transite par le dashboard : le
      backend en génère un, l'envoie au collaborateur et impose sa rotation.
- [x] Blocage/déblocage d'un collaborateur — **livré**, mais **pas** via
      `user-permission` : ce module backend est un squelette généré par le CLI
      Nest, ses méthodes renvoient des chaînes et ne touchent pas la base. Le
      blocage passe donc par `PATCH /user/:id { isBlocked }`, seul chemin
      cloisonné par `assertSameCompany()`. À supprimer ou implémenter côté
      backend ; en l'état il expose cinq routes sans effet.
- [ ] Limites connues de `/staff`, à traiter avec le reste de la phase 3 :
      - le tri est indisponible — `UserFilterDto` n'expose ni `orderBy` ni
        `order`, et `forbidNonWhitelisted` transforme tout paramètre en trop en
        400 ;
      - on ne peut pas **retirer** l'affectation à une agence : `seatId` est
        validé par `@IsValidObjectId` et refuse `null` ;
      - les permissions fines (`canCutTicket`, `canWithdrawFromSeatWallet`…)
        sont créées avec leurs valeurs par défaut, sans écran d'édition.

### Phase 4 — Pilotage et statistiques — **livrée**

Prérequis levé d'abord : **chantier E** (cadrage entreprise des statistiques,
§6 septies). Sans lui, ces trois pages auraient affiché à chaque chef
d'entreprise le chiffre d'affaires de toute la plateforme.

- [x] `/dashboard` : chiffre d'affaires, passagers, part prélevée par Travelas
      et nombre d'agences (`GET /statistics/dashboard`), courbe de recette,
      courbe de passagers et classement des agences. Sélecteur de période
      (`aujourd'hui`, `7 jours`, `ce mois-ci`, `ce trimestre`, `cette année`),
      porté par l'URL donc partageable.
- [x] Graphiques : `TrendChart` (Recharts, courbes et aires) et `RankingBars`
      (barres horizontales **sans bibliothèque** — des `<div>` de largeur
      proportionnelle, zéro octet de JavaScript et une valeur étiquetée en
      clair à côté de chaque barre).
- [x] `/revenue` : recettes journalières consolidées
      (`GET /daily-recipe/myCompany`, **ajouté au backend** avec cette page) et
      export CSV.
      `GET /statistics/export` n'est pas utilisé : il renvoie
      `{ message: "Export CSV en cours de préparation" }` et ne produit aucun
      fichier. Le CSV est donc assemblé par un route handler
      (`/api/exports/revenue`), qui neutralise au passage l'**injection de
      formule** — un tableur exécute une cellule commençant par `=`, `+`, `-`
      ou `@`, et un nom d'agence est saisi par un utilisateur.
- [x] `/statistics` : vue comparative multi-agences — recette et frais de
      plateforme superposés sur **un seul axe** (deux échelles verticales
      inventeraient une corrélation absente des données), classement des
      agences, panier moyen et note moyenne.
- [x] Palette de graphiques validée par la compétence `dataviz` : jetons
      `--chart-1..3` vérifiés sur les deux surfaces réelles (bande de clarté
      OKLCH, chroma, séparation daltonienne ΔE ≥ 8, contraste ≥ 3:1).
      `brand-500` échoue la bande sombre — d'où `brand-600` en `--chart-1`.

Limites connues :

- les totaux de `/revenue` portent sur la **page affichée**, ce que dit leur
  libellé. Un total de période exigerait une agrégation backend ; l'inventer
  côté client afficherait un chiffre faux dès la deuxième page ;
- l'export est plafonné à 1 000 lignes, par pages de 100 (la taille de page est
  bornée côté backend) ;
- la période `custom` de `StatisticsFilterDto` n'est pas exposée : elle exige
  `startDate` et `endDate`, donc un sélecteur de dates complet. Les cinq
  périodes prédéfinies couvrent le pilotage courant.

### Phase 5 — Exploitation — **livrée**

- [x] `/journeys` : trajets (`GET /company-journey/getMyCompanyJourneys`),
      filtres agence / visibilité / classe, tri sur date, prix et places.
      **Lecture seule** : `POST` et `PATCH /company-journey` sont réservés à
      `agency_admin` et `super_admin` — un bouton « Modifier » ne produirait
      qu'une 403. Pas de champ de recherche : `FindCompanyJourneyDto` n'expose
      pas `search`, et `forbidNonWhitelisted` en ferait une 400.
- [x] `/tickets` : billets (`GET /ticket/getMyCompanyTickets`), recherche
      (acheteur, passagers, gares) et filtres paiement / type. Le montant
      affiché est `paidAmount` — ce que le voyageur a réglé — et non `amount`,
      qui ignore les frais.
- [x] `/incidents` : signalements (`GET /issue/myCompany`, **ajouté au
      backend**) avec **traitement et annotation** (`PATCH /issue/:id/resolution`,
      également ajouté), et excès de vitesse (`GET /speed-issue`) en lecture
      seule. Deux onglets plutôt qu'une liste unifiée : les deux objets n'ont ni
      la même forme ni le même cycle de vie. L'anonymat demandé par un voyageur
      est tenu **côté serveur** : `toIssue()` ne projette alors aucune identité.
- [x] `/opinions` : avis clients (`GET /opinion/myCompany`), filtre par tranche
      de note. Lecture seule — `PATCH` et `DELETE /opinion/:id` sont réservés au
      `super_admin`, et une entreprise qui effacerait ses mauvaises notes
      viderait la notation de son sens. L'auteur est réduit à un prénom et une
      initiale avant de franchir la frontière serveur.

Limites connues :

- le tri n'est disponible que sur `/journeys`. Ailleurs, les DTO n'exposent pas
  `orderBy` (`UserFilterDto`, `FilterOpinionDto`, `FindIssueDto`) ou l'enum ne
  vise que des colonnes du trajet (`TicketFilterEnum`), sans effet hors
  recherche ;
- `/incidents` ne filtre pas les excès de vitesse par agence :
  `SpeedingIssueEntity` est rattachée à l'**entreprise**, pas à une agence.

### Phase 5 bis — Réglages du compte — **livrée**

`/settings` regroupe ce qui relève de la **personne**, là où `/company` regroupe
ce qui relève de l'entreprise. La page appelle `requireSession()` et **non**
`requireCompanySession()` : un compte dont l'onboarding n'est pas terminé doit
malgré tout pouvoir changer un mot de passe compromis. `/profile`, qui figurait
dans `ROUTES` sans page, n'a plus lieu d'être — tout est ici.

- [x] **Profil** (`PATCH /user`, sans identifiant : la cible est le porteur du
      token) — prénom, nom, nom d'utilisateur, téléphone. Ni `role`, ni
      `isBlocked`, ni `seatId` : ils appartiennent aux `SELF_PROTECTED_FIELDS`
      du backend, les envoyer produit une 400. C'est le comportement voulu.
- [x] **Photo de profil** (`POST /auth/profile/image`, champ `image` —
      et non `file` comme sur `PATCH /user`) et son retrait
      (`POST /auth/profile/image/delete`). ⚠️ Cette route refuse le **WebP**
      (`/^image\/(jpeg|jpg|ico|png)$/i`), contrairement aux images d'entreprise :
      `<ImageCropper allowWebp={false}>` garantit une sortie JPEG ou PNG, sans
      quoi le recadrage d'un WebP revenait en 400 après téléversement complet.
- [x] **Mot de passe** (`POST /auth/changePassword`) — l'ancien est exigé par le
      backend, la session ouverte ne suffit pas. Les règles appliquées sont
      celles de l'inscription (`strongPasswordSchema`), plus strictes que les
      six caractères de `ChangePasswordDto`. La session **n'est pas** révoquée :
      le backend ne touche pas `isLoggedOut`, et les autres sessions du compte
      restent valables — limite qui disparaîtra avec le chantier A.
- [x] **Adresse e-mail** — parcours en deux temps, **ajouté au backend**
      (§6 octies) : `POST /auth/requestEmailChange` puis
      `POST /auth/confirmEmailChange`. L'adresse actuelle ne bouge pas tant que
      la nouvelle n'est pas prouvée.
- [x] **Préférences** — langue et thème. La langue est en outre enregistrée sur
      le compte (`PATCH /user { lang }`), ce que le sélecteur de la barre
      supérieure ne fait pas : `UserLangEnum` sert aux e-mails et aux
      notifications poussées, envoyés hors de ce dashboard.
- [x] **Accès** — rôle, entreprise, agence de rattachement, en lecture seule.
      Les afficher explique ce qu'on peut faire ; les rendre modifiables serait
      une promesse que le backend refuse, à raison.

Limites connues :

- **la double authentification n'est pas exposée.** `UserEntity.is2fAuthEnable`
  existe et se modifierait très bien par `PATCH /user`, mais **rien ne la lit** :
  `login()` ne s'en sert pas, aucun second facteur n'est envoyé. Un
  interrupteur ici ne changerait rien au comportement réel — c'est-à-dire qu'il
  mentirait. À brancher avec la phase 6, côté backend d'abord ;
- **le mot de passe change sans déconnecter les autres appareils** (voir
  ci-dessus, chantier A) ;
- `POST /auth/profile` (l'autre route de mise à jour de profil, sans DTO) reste
  exposée et n'est pas utilisée par ce dashboard. Elle ne peut plus déplacer une
  adresse e-mail (§6 octies), mais elle mériterait d'être supprimée : son
  `@Body() profileData: any` échappe au `ValidationPipe` global.

### Phase 6 — Temps réel, notifications, qualité (≈ 4 j)

- [ ] Socket.io (le backend expose `AuthentificatedSocketAdapter` + adaptateur
      Redis) : incidents et ventes en direct. Le token étant en cookie
      `httpOnly`, prévoir un ticket WebSocket à usage unique délivré par un
      route handler — ne jamais rendre le JWT lisible au client.
- [ ] Notifications in-app (`/user-notification`).
- [ ] Journal d'audit des actions sensibles (création de compte, changement de
      rôle, suppression d'agence).
- [ ] Accessibilité (navigation clavier, contrastes, `aria-live`), i18n FR/EN
      (`UserLangEnum`), thème sombre.
- [ ] CI : `typecheck` + `lint` + `build` + tests sur chaque PR.

---

## 5. Conventions de développement

- **Un dossier par domaine** dans `src/features/<domaine>/` :
  `api.ts` (serveur), `schemas.ts` (Zod), `actions.ts` (Server Actions),
  `components/`, `hooks/`.
- **Server Components par défaut.** `"use client"` seulement pour
  l'interactivité (formulaires, graphiques, menus).
- **Lecture** : Server Component + `apiFetch`. **Écriture** : Server Action ou
  route handler, jamais un `fetch` direct du navigateur vers l'API.
- **Toute réponse backend est validée par un schéma Zod.** Jamais de `as`.
- Nommage : fichiers `kebab-case`, composants `PascalCase`, hooks `useXxx`.
- Textes d'interface en français ; code, commentaires techniques et noms de
  variables en anglais sauf termes métier.

---

## 6. Modifications backend requises

Chantiers à mener dans `/home/ubuntu/Bureau/Projets/Nest-project/travelas-backend`.

> **Chantiers B, C, E, G, H et I : traités**, et F pour l'essentiel. Voir le
> §6 bis (cloisonnement), le §6 quater (vérification d'e-mail), le
> §6 quinquies (fuseaux horaires) et le **§6 septies** (cadrage des
> statistiques, des recettes, des incidents et des contacts).

### 🔴 Chantier A — Durée de vie des tokens (`src/auth/auth.module.ts:37`)

L'access token vit **30 jours**, le refresh **60 jours**
(`auth.service.ts:402`). Un token volé reste exploitable un mois, et rien ne
permet de le révoquer individuellement.

**À faire** : `expiresIn: '15m'` pour l'access token, 7 jours pour le refresh,
avec rotation à chaque usage (stocker un hash du refresh en base et invalider
l'ancien). Le dashboard implémentera alors `/api/auth/refresh` (phase 1).

### ✅ Chantier B — Cloisonnement multi-entreprises (IDOR) — **traité**

Voir §6 bis.

### ✅ Chantier C — Inscription d'un chef d'entreprise — **sans objet**

Vérification faite : `POST /auth/create` force déjà `role = company_admin`
(`auth.service.ts:281`), le `UserSubscribeDto` ne portant simplement pas le
champ. Le parcours inscription → vérification e-mail → `POST /company` est
donc opérationnel, et il a été exécuté de bout en bout (§6 bis).

Aucun endpoint supplémentaire n'est nécessaire. Reste souhaitable : un rate
limit dédié sur `/auth/create`, plus strict que le throttler global.

### 🟠 Chantier D — CORS et en-têtes

`src/config/cors.config.ts` n'autorise que les origines de `ALLOWED_ORIGINS`,
mais **laisse passer toute requête sans `Origin`** (`if (!origin) return
callback(null, true)`). Acceptable pour l'app mobile, à restreindre par
préfixe de route sinon. Ajouter également `helmet` sur l'API.

### ✅ Chantier E — Statistiques cadrées entreprise — **traité**

Voir §6 septies. Le filtre `companyId` était non seulement lu depuis la requête,
mais la plupart des agrégats n'étaient **pas cadrés du tout**.

### ✅ Chantier G — Contacts d'agence cadrés entreprise — **traité**

Voir §6 septies. Les contacts sont branchés sur `/seats/[id]`.

### ✅ Chantier H — Vérification d'e-mail — **traité**

Voir §6 quater.

### ✅ Chantier I — Fuseaux horaires — **traité**

Voir §6 quinquies.

### 🟡 Chantier F — Hygiène — **traité pour les fuites, reste l'uniformisation**

- [x] `JwtStrategy.validate()` journalisait l'**entité utilisateur complète** —
      hash de mot de passe et sel compris — à **chaque requête authentifiée**.
      C'était la fuite la plus volumineuse de l'API. Supprimée.
- [x] `AuthService.createAdmin()` journalisait `adminData`, qui porte le **mot
      de passe en clair**. Supprimée.
- [x] `CompanyJourneyService.getSearch()` et `OpinionService.findByCompany()`
      journalisaient leurs filtres à chaque recherche. Supprimées.
- [x] `DurationInterceptor` vérifié : il ne journalise que deux horodatages et
      une durée, jamais le corps de la requête.
- [ ] Uniformiser les réponses d'erreur (le login mêle statuts métier en 200 et
      exceptions HTTP). **Non traité** : le changer casserait l'application
      mobile, qui lit ces statuts.

---

## 6 bis. Correctifs backend livrés

Tous vérifiés par un test d'intégration rejouable :

```bash
cd ../../Nest-project/travelas-backend
npm run build && npm run start:prod        # dans un terminal
node scripts/test-cloisonnement-entreprises.js
```

Le script monte deux entreprises concurrentes de bout en bout et exécute
**21 contrôles**. Il a été passé sur le code *avant* correctif comme contrôle
négatif : **10 des 21 échouaient**, confirmant que chaque faille listée était
réellement exploitable.

### Escalade de privilèges

- `src/helpers/company-scope.helper.ts` : liste blanche `CREATABLE_ROLES`.
  Un `company_admin` ne peut créer/promouvoir que `agency_admin`,
  `company_agent`, `company_driver`.
  *Avant : `POST /user/create` renvoyait 201 avec `role: "super_admin"`.*
- `PATCH /user/:id` et `PATCH /user` appliquent la même liste blanche.
- `SELF_PROTECTED_FIELDS` : personne ne peut modifier sur son propre compte
  `role`, `isBlocked`, `isActive`, `isEmailVerify`, `isPhoneVerify`, `seatId`,
  `permission`. *Avant, un client mobile pouvait valider son propre e-mail.*
- `PLATFORM_ONLY_FIELDS` : `walletAmount`, `plateformAmount`, `companyId`,
  `sponsorshipCode` réservés au `super_admin`. *Avant, `Object.assign` les
  écrivait tels quels — création de solde à volonté.*

### `@Roles()` non appliqué — le plus grave

`RolesGuard` n'était pas global et **7 handlers portaient un `@Roles()` sans
`@UseGuards(RolesGuard)`** : la restriction n'était jamais évaluée. Sur
`DELETE /user/:id`, n'importe quel compte authentifié — y compris un client
mobile — pouvait supprimer n'importe quel utilisateur (vérifié : `200 {"status":"ok"}`).

Corrigé en enregistrant `RolesGuard` comme `APP_GUARD` dans `auth.module.ts`,
**après** `JwtAuthGuard` : Nest exécute les gardes globales dans l'ordre du
tableau `providers`, donc `request.user` est renseigné quand la garde s'exécute.
Déclarée dans `app.module.ts`, elle s'exécutait avant l'authentification et
refusait tout en 403.

### Cloisonnement multi-entreprises (IDOR)

| Endpoint | Avant | Après |
|---|---|---|
| `GET /seat/:seatId` | lisait l'agence d'un concurrent | 403 |
| `PATCH /seat/:id` | renommait l'agence d'un concurrent | 403 |
| `DELETE /seat/:seatId` | supprimait l'agence d'un concurrent | 403 |
| `PATCH /company/:id` | renommait l'entreprise d'un concurrent | 403 |
| `POST /user/create` (`seatId`) | affectait du personnel chez un concurrent | 403 |
| `PATCH /user/:id`, `GET /user/:id` | atteignaient les comptes d'autres entreprises | 403 |
| `POST /company` | créait des entreprises en série, orphelinant les précédentes | 401 |
| `POST /seat` | créait une agence orpheline sans entreprise | 403 |

`assertSameCompany()` est le point de passage unique ; `seat.service` charge la
ressource via `assertSeatBelongsToUser()` **avant** toute écriture.

### Deux bugs bloquants découverts en testant

- **Toute première connexion en 500.** `login()` créait la permission manquante
  via `save({ user })`, dont la relation inverse produit une structure
  circulaire qu'Express ne peut pas sérialiser. Aucun compte nouvellement
  inscrit ne pouvait donc se connecter. Cycle rompu dans `auth.service.ts`.
- **Un échec SMTP tuait l'API entière.** Les envois d'e-mail sont déclenchés
  sans `await` ; une erreur produisait un rejet non géré, et Node arrête le
  processus. Constaté en conditions réelles. `MailService.safeSend()` intercepte
  et journalise désormais.
- Au passage, `password` et `salt` ne sont plus renvoyés dans la réponse de
  login.

---

## 6 ter. Correctifs backend livrés avec `/staff`

Tous dans `src/user/user.service.ts`. **Non rejoués** par
`test-cloisonnement-entreprises.js` : la base de l'environnement de
développement (`MYSQL_ADDON_URI`, hébergée) était injoignable au moment de la
livraison. À repasser dès qu'un accès base est disponible.

### Pagination annoncée mais jamais appliquée

`getUsers()` et `getByCompanyId()` acceptaient `page` et `count`, puis
construisaient leur `QueryBuilder` **sans `skip`/`take`** :
`GET /user/getMyCompanyUsers?page=0&count=10` renvoyait donc *tout* le personnel
de l'entreprise, à chaque appel — coût en base et en bande passante croissant
avec l'effectif, et pagination purement décorative côté client.

`getBySeatId()` appliquait bien `skip(page * count)`, mais avec des paramètres
optionnels : un appelant les omettant produisait `skip(NaN).take(undefined)`,
soit le même effet. Les trois passent désormais par un helper commun
`applyPagination()`, qui borne la page à 0 et la taille à 100.

### Cloisonnement

`getByCompanyId()` recevait `user.company?.id`. Sans entreprise rattachée, la
clause `WHERE user.company.id = :companyId` partait avec un paramètre indéfini.
Le cas est maintenant refusé explicitement (403).

### Journalisation et réponses

- `console.log(newUser)` dans `create()` écrivait l'entité complète — **hash de
  mot de passe et salt compris** — dans les logs applicatifs. Remplacé par une
  ligne d'identifiant et de rôle.
- `console.log(filters)` retiré de `getUsers()`.
- `POST /user/create` et `PATCH /user/:id` renvoyaient l'entité TypeORM telle
  quelle : `password` et `salt` partaient dans la réponse HTTP à chaque création
  de collaborateur. `UserService.withoutSecrets()` les retire, comme cela avait
  déjà été fait sur la réponse de login.

---

## 6 quater. Correctifs backend livrés avec l'inscription (chantier H)

Tous dans `travelas-backend`, vérifiés en exécution sur l'API de développement.

### Code de vérification devinable

`sendConfirmationEmail()` tirait le code avec
`Math.floor(100000 + Math.random() * 9000)` : l'intervalle réel n'était pas
100 000–999 999 mais **100 000–108 999**, soit 9 000 valeurs — quelques minutes
de force brute — et `Math.random()` n'est pas un générateur cryptographique.
Remplacé par `crypto.randomInt(100000, 1000000)` (900 000 valeurs, source sûre),
avec évitement de collision : `emailToken` est une colonne `UNIQUE`, une
collision faisait échouer l'inscription sur une erreur de contrainte.

Au passage, la suppression des jetons précédents n'était pas `await`ée : elle
pouvait s'exécuter **après** l'insertion du nouveau et l'effacer aussitôt.

### Détournement d'une inscription en cours

`POST /auth/updateUnverifyEmail` est ouvert (`@SkipAuth()`) et ne demandait que
les deux adresses : connaître l'adresse d'une inscription non vérifiée suffisait
à la remplacer par la sienne, puis à vérifier le compte — donc à s'approprier un
compte créé au nom d'un tiers. La route exige désormais le `userId` (un UUID,
inconnu de l'attaquant) et vérifie qu'il correspond bien au compte trouvé.
`UpdateUnverifiedEmailDto` valide l'ensemble.

Vérifié en exécution : sans `userId` → 400 ; avec un `userId` étranger → 404.

### Doublons d'adresse

`updateUnveriryEmail()` ne vérifiait pas que la nouvelle adresse était libre,
alors que `create()` le fait : deux comptes pouvaient porter le même e-mail, que
`login()` (`findOneBy({ email })`) ne sait plus départager. Le contrôle est
ajouté, avec le même code métier que l'inscription (`duplicate email`).

### Quotas dédiés

Le throttler global (100 req/min/IP) était la seule barrière sur des routes qui
envoient un e-mail ou acceptent un code. `@Throttle` par route : 5 / 10 min sur
`/auth/create`, `/auth/sendConfirmationEmail` et `/auth/updateUnverifyEmail`,
10 / 10 min sur `/auth/email` et `/auth/resetPassword`. Les limiteurs nommés du
module (`short`, `medium`, `long`) imposent de surcharger `long` : un override
sur `default` n'aurait jamais été consulté.

### Deux fuites trouvées sur le chemin de la réinitialisation

- `ResetStrategy.validate()` journalisait l'entité utilisateur complète —
  **hash de mot de passe et sel compris** — à chaque réinitialisation.
- `MailService.sendUserConfirmationEmail()` produisait des liens en
  `?next=undefined` lorsque le paramètre était absent, c'est-à-dire toujours
  depuis ce dashboard.

---

## 6 quinquies. Fuseaux horaires : la base passe en UTC (chantier I)

### Ce qui n'allait pas

`src/database/database.module.ts` configurait le pilote MySQL en
`timezone: "+01:00"` — l'heure du Cameroun — alors que le serveur de base
tourne en **UTC**. Ce réglage ne décrit pas « le pays d'utilisation » : il dit
au pilote dans quel fuseau lire et écrire les chaînes `datetime`. Deux
référentiels cohabitaient donc dans les mêmes colonnes :

| Écrites par | Contenu réel | Symptôme |
|---|---|---|
| MySQL (`createAt`, `updateAt` : `DEFAULT CURRENT_TIMESTAMP`) | UTC | relues **1 h trop tôt** → tout code de vérification naissait expiré |
| L'application (`travelDate`, `lastLogin`, `cutAt`, `blockedUntil`, `deleteAt`…) | heure de Douala | `travelDate >= NOW()` comparait Douala à UTC → un trajet restait « à venir » une heure de trop |

Mesuré avant correctif, sur une ligne insérée à l'instant :

```
ancien  (createAt)    : age lu = 3600 s  -> expire ? true
nouveau (expiresAtMs) : reste  300 s     -> expire ? false
```

Le round-trip des dates écrites par l'application, lui, tombait juste — mais
seulement parce que le fuseau du serveur applicatif (`Africa/Douala`) valait
lui aussi +01:00. Vérifié par sonde TypeORM : c'est le pilote, et non TypeORM,
qui formate les `Date`, donc écriture et lecture se compensaient.

### Ce qui a été fait

1. **`timezone: "Z"`** : un seul référentiel, UTC, de la base aux objets `Date`.
   Les colonnes remplies par MySQL redeviennent lisibles, et les comparaisons
   SQL (`travelDate >= NOW()`, `DATE(createAt) = DATE(NOW())`) portent enfin sur
   des grandeurs de même nature.
2. **`scripts/migrate-timezone-utc.js`** : recale de −1 h les colonnes écrites
   par l'application, qui contenaient l'heure de Douala et se liraient sinon
   une heure dans le futur. Le script énumère les colonnes depuis
   `information_schema` (39 trouvées), préserve `updateAt` d'une réécriture par
   `ON UPDATE CURRENT_TIMESTAMP`, tourne à blanc par défaut et se marque dans
   une table `tz_migration` — une seconde exécution ne décale rien.
   Le Cameroun n'ayant pas d'heure d'été, le décalage est constant : aucune
   ambiguïté saisonnière.

   ```bash
   node scripts/migrate-timezone-utc.js            # plan
   node scripts/migrate-timezone-utc.js --confirm  # applique
   ```

3. **L'heure du Cameroun devient une affaire d'affichage** : `APP_TIME_ZONE`
   (`src/i18n/config.ts`) vaut `Africa/Douala` et alimente next-intl. Le
   dashboard déclarait jusqu'ici `Africa/Abidjan`, qui est à UTC+0 — les heures
   se seraient affichées avec une heure de retard une fois le backend en UTC.

4. `AuthEntity.expiresAtMs` reste un entier d'époque : la péremption des codes
   ne dépend plus d'aucun réglage de fuseau, ni côté base ni côté application.

### Vérifié en exécution

- `createAt` relu avec `Z` : âge = 0 s pour une ligne insérée à l'instant
  (contre 3 600 s avant).
- Migration appliquée sur la base de développement : `myuser.lastLogin`
  `2026-07-16 20:57:46` → `19:57:46`, `connection-tracking.lastActivity` de même.
- Relance du script : « déjà appliquée, rien à faire ».

### Reste à surveiller

Le jour où l'API sera déployée ailleurs que sur une machine en UTC+1, plus rien
ne dépendra du fuseau de l'hôte — c'est précisément l'objet du changement. En
revanche, tout nouvel affichage de date **doit** passer par `APP_TIME_ZONE` (ou
`getFormatter()` de next-intl) : un `toLocaleString()` sans fuseau explicite
afficherait l'heure du navigateur.

---

## 6 sexies. `login()` vérifie le mot de passe avant tout le reste

Livré avec la reprise de vérification depuis l'écran de connexion.

`auth.service.login()` testait `isEmailVerify || isPhoneVerify` **avant** de
comparer le mot de passe : `account_not_verified` partait donc à qui saisissait
n'importe quel mot de passe sur une adresse existante. Deux conséquences :

- **un oracle d'énumération** — le statut distinguait « ce compte existe et
  n'est pas vérifié » de « identifiants invalides », sans qu'aucune preuve n'ait
  été apportée ;
- **un statut inexploitable** — le dashboard ne pouvait rien en faire :
  rouvrir un écran de vérification sur cette seule base aurait travaillé pour le
  compte d'un tiers, et le renvoi de code serait devenu un outil de harcèlement
  par e-mail.

L'ordre est inversé : mot de passe d'abord, statut de vérification ensuite. Le
compteur d'échecs (`auth-login`, blocage à `MAX_LOGIN_FAIL_COUNT`) couvre donc
aussi les comptes non vérifiés. `bcrypt.compare` est protégé contre un hash
absent — les comptes créés via Firebase n'en ont pas.

Ce n'est qu'après cette validation que la réponse porte `userId` et `email`,
de quoi reprendre la vérification. Le dashboard les range aussitôt dans le
cookie `httpOnly` et ne les renvoie pas au navigateur.

Vérifié en exécution : compte non vérifié + mauvais mot de passe →
`wrong_password`, aucun cookie posé (auparavant : `account_not_verified`).

Au passage, `login()` ne journalise plus ni `loginCredentialsDto` (**mot de
passe en clair**) ni l'entité utilisateur (**hash et sel**) — deux `console.log`
du chantier F, sur la fonction la plus appelée de l'API.

---

## 6 septies. Cadrage entreprise du pilotage et de l'exploitation

Livré avec les phases 4 et 5. Tous les correctifs sont dans `travelas-backend`,
et tous répondent à la même question : **de quelle entreprise sont ces
données ?** — question que plusieurs modules ne se posaient pas.

### Chantier E — les statistiques ne cadraient rien

`StatisticsService` calculait la plupart de ses agrégats sur la table entière.
`getDashboardStatistics()` — l'endpoint que la vue d'ensemble devait consommer —
sommait `totalSeatRecipe` et `passengerCount` de **toutes les entreprises de la
plateforme** :

```ts
// avant
this.dailyRecipeRepository.createQueryBuilder('dailyRecipe')
  .select('SUM(dailyRecipe.totalSeatRecipe)', 'total')
  .where('dailyRecipe.createAt BETWEEN :start AND :end', { start, end })
```

Aucune jointure, aucune clause d'entreprise. Chaque chef d'entreprise aurait donc
lu le chiffre d'affaires consolidé de ses concurrents, dès l'ouverture de son
tableau de bord.

Le correctif tient en une fonction, `resolveScope()`, appliquée à **tous** les
endpoints du module :

- pour un `company_admin`, `companyId` est **écrasé** par celui du compte —
  le paramètre de requête n'est honoré que pour un `super_admin` ;
- un `agency_admin` est en outre réduit à son agence ;
- un périmètre vide n'est renvoyé qu'au `super_admin` : toute autre absence de
  rattachement lève une 403, au lieu de dégrader silencieusement en « toute la
  plateforme ».

`DailyRecipeEntity` n'ayant pas de colonne `companyId`, le cadrage passe
obligatoirement par la jointure `seat → company` : `dailyRecipeScope()` et
`ticketScope()` la posent une fois pour toutes.

Trois bugs sont tombés en même temps :

- **`applyUserFilters()` était inutilisable.** Il ajoutait une clause
  `companyJourney` à une requête sur `UserEntity`, qui n'a pas cette relation :
  `GET /statistics/overview` levait donc une erreur TypeORM pour tout
  `company_admin`. Remplacé par un cadrage sur les vraies relations du compte.
- **`seat.company.id` ne se résout pas** dans une clause SQL brute
  (`getTopPerformers`) : la jointure est désormais explicite.
- **Le graphique journalier exécutait une requête par jour** : 365 allers-retours
  en base pour une période d'un an. Une seule requête groupée par jour les
  remplace, la série étant complétée côté application — un graphique qui saute
  les jours sans vente écraserait l'axe du temps.

Ajouté au passage : `fees` dans la vue d'ensemble (la part prélevée par
Travelas), et un refus explicite du classement **des entreprises** pour un
`company_admin` — un classement d'agences lui est utile, celui de ses
concurrents n'a pas à lui être servi.

### Recettes journalières — IDOR et injection SQL

`DailyRecipeService` recevait `user` sur quatre méthodes et ne s'en servait
jamais. `GET /daily-recipe/seat/:seatId` livrait donc le chiffre d'affaires de
**n'importe quelle agence** à n'importe quel chef d'entreprise : l'identifiant
suffisait. `findToday()`, `findOne()` et `getCumulativeSum()` étaient dans le
même cas. Toutes passent désormais par `assertSeatInScope()` /
`assertSameCompany()`.

`getCumulativeSum()` interpolait par ailleurs son paramètre directement dans le
SQL :

```ts
.select(`SUM(dailyRecipe.${field})`, 'sum')   // `field` vient de l'URL, non validé
```

Le champ est maintenant validé contre une liste blanche.

Ajouté : **`GET /daily-recipe/myCompany`**, cadré entreprise, avec filtre
d'agence et de période. Sans lui, une vue consolidée du chiffre d'affaires
imposait une requête par agence — et ne donnait aucun total.

Corrigé aussi : `@Get(':id')` était déclaré **avant** `mySeatCumulativeSum`, que
Nest capturait donc en paramètre. La route était inatteignable.

### Incidents — un module entièrement ouvert

`IssueController` ne portait **aucun `@Roles()`**. `GET /issue` renvoyait donc
les signalements de toutes les entreprises de la plateforme à n'importe quel
compte authentifié — client mobile compris — et `PATCH`/`DELETE /issue/:id`
étaient tout aussi ouverts. Même famille de faille que le `DELETE /user/:id` du
§6 bis.

- `@Roles()` posé sur chaque handler ;
- **`GET /issue/myCompany`** ajouté, cadré entreprise, avec filtres et
  pagination ;
- **`PATCH /issue/:id/resolution`** ajouté, avec trois colonnes nouvelles sur
  `IssueEntity` (`isResolved`, `resolvedAt`, `resolutionNote`). Route distincte
  de `PATCH /issue/:id` à dessein : le **texte** du signalement appartient au
  voyageur qui l'a rédigé, l'entreprise n'en pilote que le suivi.

### Chantier G — contacts d'agence

`SeatContactService` comparait `user.companySeat.id` à l'agence du contact : un
chef d'entreprise sans rattachement levait une 500 (`TypeError`), et celui qui
en avait un se voyait refuser ses **autres** agences. `assertSameCompany()` pose
la bonne règle — l'entreprise, pas l'agence — et `bySeat/:seatId` est ouvert au
`company_admin`.

### Trajets et billets — filtres qui ne cadraient pas

`GET /company-journey/bySeat/:seatId` et `GET /ticket/bySeat/:seatId` se
contentaient d'ajouter `seatId` au filtre : l'identifiant d'une agence
concurrente renvoyait ses trajets et ses billets. L'entreprise de l'appelant est
maintenant croisée avec le filtre.

`GET /ticket/getTicketsAggregationBySeatId/:seatId` **ignorait son propre
paramètre** au profit de `user.companySeat.id` — la route renvoyait donc
l'agrégation de l'agence de rattachement de l'appelant, quelle que soit l'agence
demandée, et une 500 pour un chef d'entreprise sans agence.

Enfin, `getMyCompanyTickets` passe de `getCompanyTickets()` à `getTickets()` :
la variante « entreprise » chargeait les billets **sans leur trajet** (donc sans
agence ni gares, illisible dans une liste), forçait `travelDate >= NOW()` — ce
qui masquait tout l'historique — et ignorait `withCount` et la recherche.

### Reste à vérifier

Ces correctifs n'ont **pas** été rejoués par
`scripts/test-cloisonnement-entreprises.js`, qui ne couvre ni les statistiques,
ni les recettes, ni les incidents. Le script mérite d'être étendu à ces trois
modules — c'est le meilleur usage d'une demi-journée sur ce projet.

---

## 6 octies. Changer d'adresse e-mail se prouve désormais

Livré avec `/settings` (phase 5 bis). Tout est dans `travelas-backend`.

### Le problème

Deux routes permettaient à un compte de changer **sa propre** adresse e-mail :

```ts
// user.service.update() — PATCH /user
Object.assign(newUser, updateUserDto);   // email compris

// auth.service.updateProfile() — POST /auth/profile
const allowedFields = ['firstName', 'lastName', 'email', …];
```

Les deux vérifiaient l'unicité de la nouvelle adresse. **Aucune ne vérifiait
qu'on la possédait.** Et `isEmailVerify` figure dans les
`SELF_PROTECTED_FIELDS` : il ne pouvait pas être modifié, donc il restait à
`true`. Le compte ressortait « vérifié » sur une adresse que personne n'avait
prouvée.

Ce n'est pas un détail cosmétique : cette adresse est **la clé de récupération
du compte**. `POST /auth/sendConfirmationEmail?reauth=true` envoie un code de
réinitialisation à l'adresse enregistrée, et ce code délivre un `reset_token`
qui change le mot de passe. Déplacer l'adresse sans preuve, c'est déplacer la
récupération du compte — au bénéfice de qui a saisi l'adresse.

### Le correctif

Une colonne, deux routes, trois refus.

**`UserEntity.pendingEmail`** (varchar 50, nullable, **sans contrainte
d'unicité**) : l'adresse demandée mais pas encore prouvée. Deux comptes peuvent
viser la même tant qu'aucun ne l'a prouvée ; l'unicité est vérifiée à la demande
**et** à la confirmation, là où elle compte.

| Route | Rôle |
|---|---|
| `POST /auth/requestEmailChange` | `{ currentPassword, newEmail }` → range l'adresse dans `pendingEmail` et lui envoie un code à six chiffres. `email` ne bouge pas. |
| `POST /auth/confirmEmailChange` | `{ token }` → installe l'adresse, efface `pendingEmail`, pose `isEmailVerify = true`. |
| `POST /auth/cancelEmailChange` | abandonne la demande et supprime le code. |

Le **mot de passe est reverifié** à la demande : une session laissée ouverte sur
un poste partagé ne suffit pas à déplacer l'adresse de récupération. Les deux
premières routes sont sous `@Throttle` (5 et 10 appels par 10 minutes) — la
première déclenche un envoi d'e-mail, la seconde est un code à deviner.

`sendConfirmationEmail()` accepte un quatrième paramètre, `recipient` : le code
part vers l'adresse **à prouver**, pas vers celle du compte. La copie ne sert
qu'au mail, `user` n'est pas modifié.

Et les deux anciens chemins refusent désormais un e-mail **différent** de
l'actuel — un client qui renvoie le profil complet, adresse inchangée comprise,
n'est pas pénalisé :

```
PATCH /user { email: "autre@…" }        → 400 « Utilisez POST /auth/requestEmailChange »
POST /auth/profile { email: "autre@…" } → 400, idem ('email' retiré d'allowedFields)
```

### Pourquoi pas un simple remplacement + `isEmailVerify = false` ?

C'était l'option courte. Elle a un coût réel : une faute de frappe déplaçait le
compte vers une boîte inexistante, et l'accès au dashboard était perdu jusqu'à
correction — récupérable par le parcours « adresse non vérifiée », mais après un
détour incompréhensible pour qui vient de se tromper d'une lettre. Avec
`pendingEmail`, l'ancienne adresse reste opérante pendant toute la vérification :
se tromper ne coûte qu'une seconde demande.

### Vérifié en exécution

`node scripts/test-changement-email.js` (backend démarré) rejoue le parcours
complet sur deux comptes concurrents : refus des deux anciens chemins, tolérance
de l'adresse inchangée, mot de passe erroné, adresse déjà prise, adresse de
connexion inchangée pendant l'attente, code d'un tiers sans effet, consommation
du code, connexion avec la nouvelle adresse, annulation.

⚠️ Le quota de `requestEmailChange` est de **5 appels par 10 minutes et par
IP** : deux exécutions rapprochées depuis la même machine s'y heurtent. Le
script le détecte et le dit, plutôt que de dérouler une cascade d'échecs qui
ressemblent à des régressions.

---

## 7. Ordre d'exécution conseillé

```
Chantiers B + C + E + G + H + I : FAITS         F : fait pour les fuites
        ↓
Phases 1 à 5 : FAITES
        ↓
Chantier A (durée de vie des tokens) ──► rafraîchissement du token (phase 1)
        ↓
Chantier D (CORS, helmet) ──► Phase 6 (temps réel, notifications, audit, CI)
```

Il ne reste, hors phase 6, que **deux chantiers backend** — A et D — et le
rafraîchissement du token, qui dépend de A.

Le chemin critique est désormais le **chantier A** : tant que l'access token vit
30 jours, aucun mécanisme de révocation n'existe, et c'est le point le plus
exposé de la plateforme.

---

## 8. Avant toute mise en production

- [ ] Chantiers **A** et **D** traités et vérifiés (B, C, E, F, G, H et I :
      faits).
- [ ] `scripts/test-cloisonnement-entreprises.js` **étendu** aux statistiques,
      aux recettes journalières et aux incidents (§6 septies).
- [ ] `node scripts/test-cloisonnement-entreprises.js` au vert.
- [ ] `node scripts/test-changement-email.js` au vert (§6 octies).
- [ ] `ALLOWED_ORIGINS` du backend contient l'origine du dashboard, et rien de plus.
- [ ] `FORCE_SECURE_COOKIES=1` ou `NODE_ENV=production` (cookies `Secure`).
- [ ] HTTPS de bout en bout (HSTS est déjà envoyé).
- [ ] Rate limiting déporté sur Redis (l'implémentation actuelle est locale au
      processus — inefficace en multi-instance, cf. `lib/security/rate-limit.ts`).
- [ ] Aucun secret dans une variable `NEXT_PUBLIC_*`.
- [ ] Collecteur d'erreurs branché (Sentry) — sans corps de requête ni cookies.
- [ ] Test de restauration de sauvegarde de la base.
