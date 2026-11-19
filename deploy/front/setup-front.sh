#!/usr/bin/env bash
# El despliegue del front vive en el repo Molinos-Front (deploy/). Este archivo solo delega (cloud-init lo llama).
set -euo pipefail
exec bash /opt/molinos/front-src/deploy/setup-front.sh "$@"
