#!/usr/bin/env bash
# Actualiza el codigo desde GitHub y reconstruye lo que corresponda a esta VM.
# Uso: sudo /opt/molinos/update.sh
set -euo pipefail
BASE=/opt/molinos
. "$BASE/branches.env"   # BACK_BRANCH / FRONT_BRANCH / ROLE
git -C "$BASE/back-src" fetch -q origin "$BACK_BRANCH" && git -C "$BASE/back-src" reset -q --hard "origin/$BACK_BRANCH"
if [ "$ROLE" = "front" ]; then
  git -C "$BASE/front-src" fetch -q origin "$FRONT_BRANCH" && git -C "$BASE/front-src" reset -q --hard "origin/$FRONT_BRANCH"
  bash "$BASE/back-src/deploy/front/setup-front.sh"
else
  bash "$BASE/back-src/deploy/back/setup-back.sh"
fi
