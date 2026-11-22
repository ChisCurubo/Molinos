# Molinos de Colombia S.A.S. — Backend del ERP

API REST en **Node 22 + TypeScript + Express** sobre **MySQL**, que digitaliza la operación de la planta: llegada y análisis de material, procesamiento y concentrado, pagos a terceros, nómina y tesorería.

## Stack

| Componente | Tecnología |
|---|---|
| Lenguaje / framework | TypeScript, Express 5 |
| Base de datos | MySQL (`mysql2`, SQL a mano, transacciones nativas). En producción: MySQL HeatWave de Oracle |
| Autenticación | JWT en cookie `httpOnly` (el token en el body solo en transición) |
| Archivos | MinIO (`pgsty/minio`) en producción; disco local en desarrollo |
| Seguridad | `helmet`, rate limit, CORS por lista, nombres de columna validados |
| Documentación de API | Swagger en `/api-docs` (**solo fuera de producción**) y mapa vivo en `GET /api/v1/info` |
| CI/CD | GitHub Actions → Oracle Cloud (ver `deploy/README.md`) |

## Arquitectura

Capas con puertos y adaptadores; toda la inyección de dependencias está en `src/config/factories/`.

```
routes → controllers → ports/service_port → services → ports/repository_port → repositories → MySQL
```

```text
src/
├── config/        entorno (modo oracle/local), config, cors, BD, swagger, factories/
├── controllers/   HTTP por módulo
├── errors/        contrato único de errores
├── helpers/       auth, rate limit, sql.helper, mailer, upload, validación
├── middlewares/   requestId, respuesta estándar, manejo de errores
├── models/        <módulo>/{app,dto,sql}
├── ports/         interfaces de servicios y repositorios
├── repositories/  SQL y transacciones
├── routes/        /api/v1/*
├── services/      reglas de negocio
└── app.ts
```

Otras carpetas: `tests/` (pruebas de endpoints), `scripts/` (Postman, mapa de endpoints, prueba de entorno), `deploy/` (Docker, scripts de la VM), `.github/workflows/` (pipeline), `.claude/` y `.agents/` (reglas para agentes de IA).

## Módulos

| Módulo | Qué cubre |
|---|---|
| `auth` | Login, usuarios, roles, recuperación de contraseña |
| `material` | Minas y zonas, tarifas, volquetas, entradas, análisis, lotes de concentrado, viajes, agua, inventario, maquila, excedente |
| `pagos` | Material, flete, agua, combustible/ACPM, mulas, alquiler, proveedores, gasto directo, anticipos, CxP/CxC, préstamos financieros, tesorería y flujo de caja, impuestos (4x1000), retenciones |
| `nomina` | Empleados, turnos y calendario, nómina quincenal, bonos, prestaciones, seguridad social, jornada nocturna legal, recargo dominical/festivo, préstamos a empleados |
| `inventario_productos` | Insumos con costo promedio ponderado |
| `archivos` | Subida, descarga y borrado de comprobantes |
| `info` | Mapa de endpoints y catálogo de errores |

Estado detallado y pendientes: `docs/estado/ESTADO_MODULOS.md` y `docs/pendiente/PENDIENTE.md` (carpeta `docs/` local, no versionada).

## Base de datos

- Esquema con comentarios (fuente de verdad): `bd/molinos_coments_v4.sql`; esquema limpio: `bd/molinos_v4.sql`.
- Vistas, triggers, inserts y migraciones con fecha: `bd/`, `bd/migraciones/`. La carpeta `bd/` **no se versiona**.
- El inventario y parte de la maquila siguen en triggers; el resto de la lógica vive en los services.
- Las migraciones las aplica una persona a mano.

## Correr en local

Requisitos: Node 22, MySQL con la BD `molinos_erp_v4` cargada.

```bash
npm ci
cp .env.example .env     # completar DB_PASSWORD y JWT_SECRET
npm run dev              # http://localhost:3005, recarga al editar
```

Comprobaciones (las mismas del pipeline):

```bash
npx tsc --noEmit
npx tsx scripts/probar-entorno.ts
npm run build
```

Pruebas de endpoints (servidor levantado en `:3005`, usan la BD real con datos aislados):

```bash
node tests/pagos/pago_flete.endpoints.test.mjs
```

## Despliegue

Push a `main` → `.github/workflows/pipeline.yml`: tipos, prueba de entorno, build, imagen Docker, validación del compose, despliegue por SSH a la VM `molinos-back` y prueba de humo en `/api/v1/health`. No toca la base de datos. Operación completa (VMs, MinIO, CORS, logs, actualización manual): `deploy/README.md`.

## Convenciones

- Errores: `ESTANDAR_ERRORES.md` (cuerpo, códigos, 4xx vs 5xx, cómo depurar con `requestId`).
- Reglas de código y de trabajo con agentes: `.claude/CLAUDE.md` y `.agents/AGENTS.md`.
- Nunca subir secretos: `.env`, llaves, `MolinosExport.sql` y la carpeta `bd/` están ignorados.
