#!/bin/bash
# Carga el esquema del ERP en MySQL HeatWave (correr desde Cloud Shell con red privada o desde una VM de la VCN).
# Usa molinos_v4.sql y vistas_v4.sql de la RAIZ del repo (resueltos desde la ruta de este script).
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
H=${1:-10.0.1.30}
read -r -s -p "Clave de molinosadmin: " PW; echo
M="mysql -h $H -u molinosadmin -p$PW --default-character-set=utf8mb4"
$M -e "SELECT VERSION(), @@lower_case_table_names AS lower_case" || exit 1
if $M -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='molinos_erp_v4'" | grep -qv '^0$'; then
  echo "La BD molinos_erp_v4 ya tiene tablas; no la toco."; exit 0; fi
for f in "$RAIZ/molinos_v4.sql" "$RAIZ/vistas_v4.sql"; do
  echo ">>> $f"; $M < "$f" || { echo "FALLO en $f"; exit 1; }
done
$M molinos_erp_v4 -e "SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='molinos_erp_v4' AND table_type='BASE TABLE') tablas, (SELECT COUNT(*) FROM information_schema.views WHERE table_schema='molinos_erp_v4') vistas, (SELECT COUNT(*) FROM usuarios) usuarios, (SELECT COUNT(*) FROM roles) roles;"
echo ">>> CARGA OK"
