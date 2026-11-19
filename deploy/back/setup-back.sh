#!/usr/bin/env bash
# Instala/actualiza el BACKEND (API + MinIO) en la VM molinos-back.
# La BD es MySQL HeatWave Always Free; sus datos de conexión vienen en /opt/molinos/db.env (cloud-init).
# Uso: sudo /opt/molinos/back-src/deploy/back/setup-back.sh
set -euo pipefail
BASE=/opt/molinos
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$BASE/secrets.env" ]; then
  gen() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1"; }
  printf 'JWT_SECRET=%s\nMINIO_ROOT_USER=molinos-admin\nMINIO_ROOT_PASSWORD=%s\n' "$(gen 48)" "$(gen 32)" > "$BASE/secrets.env"
  chmod 600 "$BASE/secrets.env"
fi
# URL pública del front: se edita a mano una vez (ver deploy/README.md). Vacía = solo funciona por el proxy del front.
if [ ! -f "$BASE/front_url.env" ]; then
  printf 'FRONT_URL=\nCOOKIE_SECURE=true\n' > "$BASE/front_url.env"
fi
cat "$BASE/db.env" "$BASE/secrets.env" "$BASE/front_url.env" > "$BASE/.env"; chmod 600 "$BASE/.env"
cd "$HERE"
docker compose --env-file "$BASE/.env" up -d --build
docker image prune -f >/dev/null || true

echo "[molinos] esperando a que la API responda (máx 90 s)..."
for _ in $(seq 1 45); do
  if R="$(curl -fs --max-time 3 http://127.0.0.1:3005/api/v1/health)"; then echo "[molinos] backend listo: $R"; exit 0; fi
  sleep 2
done
echo "[molinos] ERROR: la API no respondió en 90 s. Revisa: sudo docker compose -p molinos-back logs --tail 80 api" >&2
exit 1
