# Arquitectura y reglas del proyecto Molinos (para cualquier agente: Claude, Cursor, Cline, Antigravity…)

Backend Node 22 + TypeScript + Express + MySQL (`mysql2`, SQL a mano). Las reglas completas y vigentes están en
`.claude/CLAUDE.md`; este archivo resume la estructura de código.

## 1. Capas (`src/`)

`routes → controllers → ports/service_port → services → ports/repository_port → repositories → MySQL`

- `config/`: entorno (`entorno.ts` detecta modo `oracle`/`local`), `config.ts`, `cors.ts`, BD, Swagger y **`factories/`** (toda clase se crea e inyecta ahí).
- `controllers/`, `routes/`, `services/`, `repositories/`, `ports/` (interfaces de servicios y repositorios).
- `models/<módulo>/{app,dto,sql}`: `sql/` = tablas de la BD; `dto/` = transferencia; `app/` = uso interno.
- `errors/` (contrato de errores), `middlewares/` (requestId, respuesta estándar, errores), `helpers/` (auth, rate limit, `sql.helper`, mailer, upload, validación).

## 2. Módulos funcionales

`auth`, `material`, `nomina`, `pagos`, `archivos`, `inventario_productos`, `info`. En cada capa el código va **siempre dentro de su módulo**; nunca archivos sueltos en la raíz de una capa.

## 3. Reglas

- 1 entidad de BD = 1 modelo + 1 repositorio (no agrupar entidades en un archivo).
- Nombres `.tipo.ts`: `src/routes/nomina/turno.routes.ts`, `src/repositories/pagos/cxp.repository.ts`.
- Cada método nuevo se declara en el puerto (service y repository) **antes** de implementarlo.
- Rutas nuevas también en el `API_MAP` de `info.controller.ts`.
- Errores según `ESTANDAR_ERRORES.md`.
- Pruebas: `tests/<módulo>/*.endpoints.test.mjs` (servidor en `:3005`).

## 4. Base de datos

- Fuente de verdad: `bd/molinos_coments_v4.sql` (y `bd/molinos_v4.sql`). La carpeta `bd/` está ignorada por git; ahí también están vistas, triggers, inserts y `bd/migraciones/`.
- Las migraciones las aplica el usuario. El inventario y parte de la maquila siguen en triggers; no los dupliques en código sin confirmar.
- Antes de crear una tabla nueva, pregunta: se prefiere una columna en una tabla existente.
