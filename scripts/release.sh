#!/usr/bin/env bash
# Build, tag and push the Docker image to Docker Hub.
#
# Usage :
#   scripts/release.sh [VERSION]
#
#   VERSION : tag de version à publier (ex: 1.0.0).
#             Par défaut : hash court du commit Git courant.
#
# Variables d'environnement :
#   IMAGE          Nom complet de l'image (def: ramirokaffo/travelas-company-admin)
#   DOCKERFILE     Chemin du Dockerfile (def: Dockerfile)
#   CONTEXT        Contexte de build (def: .)
#   PLATFORMS      Plateformes pour buildx (def: vide -> build mono-archi)
#                  Ex: "linux/amd64,linux/arm64"
#   PUSH_LATEST    Pousser aussi le tag :latest (def: 1)
#   NO_CACHE       Forcer un build sans cache (def: 0)
#
#   --- Valeurs figées DANS l'image (voir l'en-tête du Dockerfile) ---
#   API_URL                 URL publique de l'API (CSP du proxy)
#   NEXT_PUBLIC_APP_URL     URL publique de ce dashboard (contrôle d'origine)
#   NEXT_PUBLIC_APP_NAME    Nom affiché dans l'interface
#   NEXT_PUBLIC_SOCKET_URL  Point d'entrée socket.io (vide = temps réel coupé)
#
# Exemples :
#   scripts/release.sh 1.0.0
#   NEXT_PUBLIC_APP_URL=https://company-admin.ysem.education \
#     API_URL=https://api.ysem.education \
#     NEXT_PUBLIC_SOCKET_URL=https://api.ysem.education \
#     scripts/release.sh 1.0.0
#   PUSH_LATEST=0 scripts/release.sh 1.2.0-rc1

set -euo pipefail

# --- Paramètres ------------------------------------------------------------
IMAGE="${IMAGE:-ramirokaffo/travelas-company-admin}"
DOCKERFILE="${DOCKERFILE:-Dockerfile}"
CONTEXT="${CONTEXT:-.}"
PLATFORMS="${PLATFORMS:-}"
PUSH_LATEST="${PUSH_LATEST:-1}"
NO_CACHE="${NO_CACHE:-0}"

API_URL="${API_URL:-http://localhost:3001}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
NEXT_PUBLIC_APP_NAME="${NEXT_PUBLIC_APP_NAME:-Travelas Entreprise}"
NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-}"

# Se placer à la racine du repo (script invocable depuis n'importe où)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# --- Version ---------------------------------------------------------------
VERSION="${1:-}"
if [ -z "${VERSION}" ]; then
    if git rev-parse --git-dir >/dev/null 2>&1; then
        VERSION="$(git rev-parse --short HEAD)"
    else
        echo "[release] Aucune version fournie et pas de dépôt Git détecté." >&2
        echo "          Usage : scripts/release.sh <VERSION>" >&2
        exit 1
    fi
fi

# Avertir si l'arbre de travail Git est sale
if git rev-parse --git-dir >/dev/null 2>&1; then
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo "[release] ATTENTION : modifications locales non commitées."
        read -r -p "          Continuer quand même ? [y/N] " reply
        case "${reply}" in
            y|Y|yes|YES) ;;
            *) echo "[release] Abandon."; exit 1 ;;
        esac
    fi
fi

# --- Garde-fou sur les URLs publiques --------------------------------------
# Une image construite avec les valeurs locales par défaut *démarre* en
# production, mais le contrôle d'origine CSRF et la CSP y pointent sur
# localhost : le dashboard est alors inutilisable, et le diagnostic coûte cher.
if [ "${NEXT_PUBLIC_APP_URL}" = "http://localhost:3000" ]; then
    echo "[release] ATTENTION : NEXT_PUBLIC_APP_URL vaut encore http://localhost:3000."
    echo "          Ces URLs sont FIGÉES dans l'image (voir l'en-tête du Dockerfile)."
    read -r -p "          Continuer quand même ? [y/N] " reply
    case "${reply}" in
        y|Y|yes|YES) ;;
        *) echo "[release] Abandon."; exit 1 ;;
    esac
fi

# --- Construction des tags -------------------------------------------------
TAG_VERSION="${IMAGE}:${VERSION}"
TAG_LATEST="${IMAGE}:latest"

TAGS=(-t "${TAG_VERSION}")
if [ "${PUSH_LATEST}" = "1" ]; then
    TAGS+=(-t "${TAG_LATEST}")
fi

BUILD_ARGS=(
    --build-arg "API_URL=${API_URL}"
    --build-arg "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}"
    --build-arg "NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}"
    --build-arg "NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}"
)

EXTRA_ARGS=()
if [ "${NO_CACHE}" = "1" ]; then
    EXTRA_ARGS+=(--no-cache)
fi

echo "[release] Image      : ${IMAGE}"
echo "[release] Version    : ${VERSION}"
echo "[release] Tags       : ${TAG_VERSION}$([ "${PUSH_LATEST}" = "1" ] && echo ", ${TAG_LATEST}")"
echo "[release] Platforms  : ${PLATFORMS:-(natif)}"
echo "[release] App URL    : ${NEXT_PUBLIC_APP_URL}"
echo "[release] API URL    : ${API_URL}"
echo "[release] Socket URL : ${NEXT_PUBLIC_SOCKET_URL:-(temps réel désactivé)}"
echo

# --- Vérification connexion Docker Hub -------------------------------------
# `docker info` n'indique pas toujours la connexion ; on tente un push à blanc.
if ! docker system info >/dev/null 2>&1; then
    echo "[release] Le démon Docker semble inaccessible." >&2
    exit 1
fi

# --- Build + push ----------------------------------------------------------
if [ -n "${PLATFORMS}" ]; then
    # Build multi-architecture via buildx (push direct).
    if ! docker buildx inspect >/dev/null 2>&1; then
        echo "[release] Création d'un builder buildx 'multiarch'..."
        docker buildx create --name multiarch --use >/dev/null
        docker buildx inspect --bootstrap >/dev/null
    fi

    echo "[release] Build & push multi-arch (${PLATFORMS})..."
    docker buildx build \
        --platform "${PLATFORMS}" \
        -f "${DOCKERFILE}" \
        "${TAGS[@]}" \
        "${BUILD_ARGS[@]}" \
        "${EXTRA_ARGS[@]}" \
        --push \
        "${CONTEXT}"
else
    # Build local mono-architecture, puis push.
    echo "[release] Build local..."
    docker build \
        -f "${DOCKERFILE}" \
        "${TAGS[@]}" \
        "${BUILD_ARGS[@]}" \
        "${EXTRA_ARGS[@]}" \
        "${CONTEXT}"

    echo "[release] Push de ${TAG_VERSION}..."
    docker push "${TAG_VERSION}"

    if [ "${PUSH_LATEST}" = "1" ]; then
        echo "[release] Push de ${TAG_LATEST}..."
        docker push "${TAG_LATEST}"
    fi
fi

echo
echo "[release] Terminé."
echo "          docker pull ${TAG_VERSION}"
if [ "${PUSH_LATEST}" = "1" ]; then
    echo "          docker pull ${TAG_LATEST}"
fi
