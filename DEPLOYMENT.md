# Déploiement — Dashboard entreprise

Ce dépôt publie l'image `ramirokaffo/travelas-company-admin`. Le déploiement
**complet** de la plateforme (API, super-admin, ce dashboard, MySQL, Redis,
reverse proxy) est décrit par un seul compose, dans le dépôt
`travelas-backend` : `deploy/docker-compose.yml`, dont le `deploy/README.md`
est le guide d'exploitation.

## Le piège à connaître avant tout

Next **inline au build** :

- tout `NEXT_PUBLIC_*` ;
- `process.env.API_URL` **lu depuis `src/proxy.ts`** — le runtime du proxy
  n'a accès qu'aux valeurs figées au build. C'est de là que sort l'origine
  `img-src` de la CSP.

Ces valeurs sont donc **dans l'image**, pas dans l'environnement du conteneur.
Une image de test n'est pas réutilisable en production, et changer un domaine
impose de republier un tag.

| Variable | Moment | Valeur attendue |
|---|---|---|
| `API_URL` (build) | `--build-arg` | URL **publique** de l'API — CSP `img-src` |
| `NEXT_PUBLIC_APP_URL` | `--build-arg` | URL publique de ce dashboard — contrôle d'origine CSRF |
| `NEXT_PUBLIC_SOCKET_URL` | `--build-arg` | URL publique de l'API (websocket) — vide = temps réel coupé |
| `NEXT_PUBLIC_APP_NAME` | `--build-arg` | nom affiché |
| `API_URL` (runtime) | environnement | adresse **interne** de l'API, `http://api:3001` |
| `API_TIMEOUT_MS` | environnement | `15000` |
| `FORCE_SECURE_COOKIES` | environnement | `1` — redondant avec `NODE_ENV=production`, gardé explicite |

Les deux `API_URL` diffèrent volontairement : le navigateur charge les images
sur le domaine public, le serveur Next appelle l'API par le réseau Docker
(pattern BFF, règle 1 de [CLAUDE.md](CLAUDE.md)).

## Publier une version

Automatiquement, par tag Git — c'est la voie normale :

```bash
git tag test-v1.2.0 && git push --tags
```

`.github/workflows/deploy-test.yml` construit l'image avec les variables
GitHub (`TEST_API_URL`, `TEST_APP_URL`, `TEST_SOCKET_URL`, `TEST_APP_NAME`),
la pousse en `test-latest` + `test-v1.2.0`, puis met à jour le seul service
`company-admin` sur le VPS.

À la main :

```bash
NEXT_PUBLIC_APP_URL=https://entreprise-test.travelas.app \
API_URL=https://api-test.travelas.app \
NEXT_PUBLIC_SOCKET_URL=https://api-test.travelas.app \
scripts/release.sh 1.2.0
```

## Vérifier l'image en local

```bash
docker build \
  --build-arg API_URL=http://localhost:3001 \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_SOCKET_URL=http://localhost:3001 \
  -t travelas-company-admin:local .

docker run --rm -p 3000:3000 \
  -e API_URL=http://host.docker.internal:3001 \
  -e FORCE_SECURE_COOKIES=0 \
  travelas-company-admin:local
```

`docker-compose.yml` (à la racine) fait tourner ce dashboard **seul** contre
une API déjà déployée ; `cp .env.docker .env` puis `docker compose up -d`.

## Sonde de santé

`GET /api/health` répond `{"status":"ok"}` sans toucher à la session ni à
l'API. Elle est exclue du `matcher` de `src/proxy.ts` — sinon le contrôle
*fail-closed* la redirigerait vers `/login` et le conteneur resterait
`unhealthy`.

## Ce qui rend l'image petite

`output: "standalone"` : `next build` n'emporte que les modules réellement
atteints par le graphe de dépendances. L'étage final est un Alpine nu, sans
`node_modules` complet, sans sources, sans cache de build, et le serveur y
tourne sous un utilisateur non privilégié.
