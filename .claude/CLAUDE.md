# Molinos ERP — Backend (instrucciones para Claude)

Backend del ERP de Molinos de Colombia S.A.S.: Node 22 + TypeScript + Express + MySQL (`mysql2`, SQL a mano, sin ORM).
Idioma del equipo y de la documentación: **español**. El repo es **público**: cero secretos.

## Cómo trabajamos (reglas del proyecto)

- **Capas y puertos:** `routes → controllers → ports (service_port) → services → ports (repository_port) → repositories → MySQL`.
  Toda clase se crea y se inyecta en `src/config/factories/*.factory.ts` (material, pagos, nomina, auth, archivos, info, inventario_productos).
  Todo método nuevo se declara **primero en los dos puertos** y después se implementa (ya se olvidó una vez y obligó a corregir módulos enteros).
- **Módulos:** `auth`, `material`, `nomina`, `pagos`, `archivos`, `inventario_productos`, `info`. Nunca archivos sueltos en la raíz de una capa.
- **1 entidad de BD = 1 archivo de modelo + 1 de repositorio.** Nombres `.tipo.ts` (`cxp.repository.ts`, `turno.routes.ts`).
- **La BD es la fuente de verdad:** `bd/molinos_coments_v4.sql` (esquema con comentarios) y `bd/molinos_v4.sql`. Lee ahí antes de tocar entidades.
  La carpeta `bd/` está en `.gitignore` (también `docs/`): ahí viven esquema, vistas, triggers, inserts v5, `bd/migraciones/` y `MolinosExport.sql` (datos reales, jamás al repo).
- **Migraciones SQL:** las escribes en `bd/migraciones/` con fecha; **las aplica el usuario** a mano. Nunca asumas que corrieron: pregunta o verifica.
- **Triggers vs app (híbrido):** el inventario y parte de la maquila siguen en triggers de BD; los de concentrado y viajes se migraron a funciones de app y el usuario hace el `DROP`. No descomentar `TriggerLogicRepository` con triggers activos.
- **Antes de crear una tabla nueva, pregunta:** el usuario prefiere una columna en una tabla existente si alcanza (rechazó `Dias_Festivos`, usamos `Turnos.es_festivo`).
- **Pagos:** todo lo que se paga vive en `Cuentas_Por_Pagar` + `Abonos_CxP`; estado y saldo se recalculan en el service, no a mano. Flete y agua: CxP por (dueño, mes), abono en cascada. El ACPM sale de la tabla `Combustible`.
- **Errores:** contrato único en `ESTANDAR_ERRORES.md` (`src/errors/`): 4xx con texto para el usuario, 5xx genérico + `requestId`. Catálogo vivo en `GET /api/v1/info/errores`.
- **Rutas nuevas** se registran también en el `API_MAP` de `src/controllers/info/info.controller.ts`. Los mapas se regeneran con `node scripts/build-endpoints-md.js`; Postman con `node scripts/build-postman.js`.
- **Pruebas:** `tests/<módulo>/*.endpoints.test.mjs` pegan al servidor vivo en `:3005` contra la BD real (`node tests/pagos/pago_flete.endpoints.test.mjs`). Crean datos aislados. `npx tsc --noEmit` debe quedar limpio.
- **Seguridad ya aplicada:** nombres de columna validados (`sql.helper.ts`), rate limit, JWT 32+ caracteres en producción, cookie `httpOnly`, `helmet`, Swagger solo fuera de producción.
- **Git:** no commitear ni empujar sin que el usuario lo pida. Al final de cada commit va la línea `Co-Authored-By` indicada por el entorno.

## Infraestructura (Oracle Cloud Always Free, Bogotá)

| Máquina | IP privada | Qué corre |
|---|---|---|
| `molinos-back` | 10.0.1.10 | Docker: API `:3005` + MinIO (`pgsty/minio`, solo 127.0.0.1) |
| `molinos-front` | 10.0.1.20 | Docker: Caddy (HTTPS sslip.io) + build de React; `/api/*` → back |
| `molinos-mysql` (HeatWave) | 10.0.1.30 | MySQL 3306, BD `molinos_erp_v4`, `lower_case_table_names=1` |

- Dos modos que se detectan solos (`src/config/entorno.ts`): `oracle` (servidor) y `local` (PC). En Docker se fija `APP_MODE=oracle` en el compose. Una variable de entorno siempre gana sobre el valor por defecto del modo.
- **Secretos** solo en `/opt/molinos/*.env` de la VM (`db.env`, `secrets.env`, `front_url.env`) y en GitHub (secret `DEPLOY_SSH_KEY`; variables `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`, `PUBLIC_URL`). Nunca en el repo. Las `ORACLE_*` y `PILOTO_*` del `.env` local no van a ningún lado.
- **Archivos:** `POST /api/v1/archivos` guarda en MinIO (o disco en local); la BD guarda la `key`, nunca una URL de MinIO.
- **Pipeline:** `.github/workflows/pipeline.yml`. En push a `main`: `npm ci` → `tsc --noEmit` → `scripts/probar-entorno.ts` → `npm run build` → build de Docker + validar compose → deploy por SSH (forced command → `update.sh`) → prueba de humo `/api/v1/health`. No toca la BD.
- Detalle operativo: `deploy/README.md`.

## Documentación (`docs/`, local, ignorada por git)

`docs/estado/` (estado de módulos, mapa de endpoints) · `docs/material/` · `docs/pagos/` · `docs/nomina/` · `docs/frontend/` (prompts para el front) · `docs/sesiones/` · `docs/pruebas/` · **`docs/pendiente/PENDIENTE.md`** (qué falta y qué hay que decidir).

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.
