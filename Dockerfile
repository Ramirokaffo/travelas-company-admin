# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Travelas Company Admin — image de production
#
# Trois étages, pour une image finale minimale :
#   deps    : `npm ci` seul, dans sa propre couche — un changement de code ne
#             réinvalide pas l'installation des dépendances.
#   builder : `next build` avec `output: "standalone"`.
#   runner  : Alpine nu + la sortie standalone. Ni `node_modules` complet, ni
#             sources, ni cache de build : Next n'y copie que les modules
#             réellement atteints par le graphe de dépendances.
#
# ATTENTION aux variables : Next **inline au build** tout `NEXT_PUBLIC_*`. Les
# `ARG` ci-dessous doivent donc porter les URLs **publiques** de l'environnement
# visé — une image de test n'est pas réutilisable en production.
#
# Les variables sans ce préfixe restent du pur runtime, `src/proxy.ts` compris :
# son bundle conserve bien `process.env.API_URL`. Le compose y met l'adresse
# interne `http://api:3001`, qui ne transite jamais par le navigateur — d'où
# `MEDIA_URL`, variable de runtime elle aussi, qui porte l'origine **publique**
# des fichiers téléversés pour la directive `img-src` de la CSP. Sans elle, le
# navigateur se voit servir une origine qu'il ne peut pas atteindre et bloque
# les logos.
# ---------------------------------------------------------------------------

FROM node:20.15.0-alpine AS base
# `libc6-compat` : certaines dépendances natives (sharp, bindings Next) sont
# compilées contre glibc et ne se chargent pas sur musl sans cette couche.
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1


# --- Dépendances -----------------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund


# --- Build -----------------------------------------------------------------
FROM base AS builder

ARG API_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_NAME="Travelas Entreprise"
ARG NEXT_PUBLIC_SOCKET_URL=

ENV NODE_ENV=production \
    API_URL=${API_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# --- Exécution -------------------------------------------------------------
FROM node:20.15.0-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Sans cela, le serveur standalone n'écoute que sur localhost et reste
    # injoignable depuis le réseau Docker.
    HOSTNAME=0.0.0.0

# Le serveur ne tourne pas en root : une faille d'exécution de code ne donne
# alors pas la main sur le système de fichiers de l'image.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# `wget` vient de BusyBox : aucun paquet supplémentaire à installer.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
