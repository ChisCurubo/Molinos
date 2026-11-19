# Despliegue piloto ERP Molinos — Oracle Cloud Always Free (Bogotá)

Este repo (backend) pone en pie `molinos-back`. El front vive en su propio repo (`Molinos-Front`, carpeta `deploy/`).

## Máquinas

| Recurso | IP privada | Qué corre |
|---|---|---|
| `molinos-back` (VM ARM Ubuntu 24.04) | 10.0.1.10 | Docker: API Node `:3005` + MinIO (9000/9001, solo en 127.0.0.1) |
| `molinos-front` (VM ARM Ubuntu 24.04) | 10.0.1.20 | Docker: Caddy con HTTPS automático `https://<ip-publica-con-guiones>.sslip.io`; sirve el build de React y reenvía `/api/*` → `10.0.1.10:3005` |
| `molinos-mysql` (MySQL HeatWave) | 10.0.1.30 | MySQL `:3306`, BD `molinos_erp_v4`, `lower_case_table_names=1` |

Firewall: 22/80/443 abiertos a internet; **3005 y 3306 solo desde 10.0.0.0/16**. El backend no es público: solo lo alcanza el front.

## Los dos modos (se detectan solos)

El backend corre en `oracle` (servidor) o `local` (tu PC). Código: `src/config/entorno.ts`.

1. Si existe `APP_MODE` (`oracle` | `local`) → manda.
2. Si alguna interfaz IPv4 de la máquina es `10.0.1.10` (`ORACLE_BACK_IP`) → `oracle`.
3. Cualquier otra cosa (localhost, 192.168.x, 172.16–31.x, otra 10.x) → `local`.

> Dentro de Docker la IP es `172.x`, no `10.0.1.10`. Por eso el `docker-compose.yml` del servidor pasa `APP_MODE=oracle`. La detección por IP solo sirve con `node`/`pm2` directo en la VM.

**Una variable de entorno siempre gana** sobre el valor por defecto del modo. Al arrancar se imprime una línea:
`[molinos] modo=oracle (APP_MODE) · BD=10.0.1.30:3306/molinos_erp_v4 ssl=on · almacenamiento=minio(minio:9000/molinos-comprobantes) · cors=[...]`

| Clave | `oracle` | `local` |
|---|---|---|
| `ENV` | production | development |
| BD | `10.0.1.30:3306`, usuario `molinos_app`, `DB_PASSWORD` **obligatoria** | `localhost:3306`, `root`, sin clave |
| `DB_SSL` | true (`rejectUnauthorized=false`: certificado propio de Oracle) | false |
| Almacenamiento | MinIO (`minio:9000`, bucket `molinos-comprobantes`) | disco (`./almacenamiento-local`) |
| `TRUST_PROXY` | 1 (Caddy delante) | 0 |
| Cookie | `httpOnly`, `secure`, `sameSite=lax` | `httpOnly`, sin `secure`, `sameSite=lax` |
| `JWT_SECRET` | obligatorio, 32+ caracteres | valor de desarrollo permitido |

Variables completas: `.env.example`.

## Base de datos

- La app usa `molinos_app` (SELECT/INSERT/UPDATE/DELETE/EXECUTE). Su clave está en `/opt/molinos/db.env` de la VM back; **nunca** en el repo.
- El administrador (`molinosadmin`) solo se usa desde Cloud Shell o por túnel SSH.
- Túnel a MySQL desde tu PC: `ssh -i molinos_oracle_ed25519 -L 3307:10.0.1.30:3306 ubuntu@<ip-publica-back>` y conectar a `127.0.0.1:3307`.
- Carga inicial de la BD: `deploy/back/db/load.sh` (esquema + vistas).

## CORS

El front llama a la API por el mismo dominio (`/api/v1`: proxy de Caddy en Oracle, proxy de Vite en local), así que casi nunca se necesita CORS. Aun así (`src/config/cors.ts`):

- Sin cabecera `Origin` (curl, healthcheck, proxy) → permitido.
- `oracle`: solo `CORS_ORIGINS`/`FRONT_URL` + `http(s)://10.0.1.20`. Sin comodines tipo `*.sslip.io`.
- `local`: `localhost`/`127.0.0.1`/IP de LAN (192.168.x, 10.x, 172.16–31.x) en los puertos 5173, 4173 y 8080.
- Origen rechazado: respuesta sin cabeceras CORS y un aviso en el log `[cors] origen rechazado: ...`. Nunca un 500.

## Dónde está MinIO y cómo se guardan archivos

- Corre en la VM **molinos-back**, contenedor `minio`. Datos en el volumen `molinos-back_minio-data` (`/var/lib/docker/volumes/molinos-back_minio-data/_data`).
- Escucha solo en `127.0.0.1:9000` (S3) y `127.0.0.1:9001` (consola). La API lo alcanza como `minio:9000`. **Nunca es público; el navegador nunca habla con MinIO.**
- Credenciales: `/opt/molinos/secrets.env` (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`). Bucket privado `molinos-comprobantes` (la API lo crea al arrancar).
- Consola web desde tu PC: `ssh -i molinos_oracle_ed25519 -L 9001:127.0.0.1:9001 ubuntu@<ip-publica-back>` → `http://localhost:9001`.

**Flujo de un archivo:**
1. El front sube con `POST /api/v1/archivos?carpeta=comprobantes` (FormData, campo `archivo`, máx **15 MB**; PDF, PNG, JPG o WebP; el tipo se verifica por los primeros bytes, no por el nombre).
2. Responde `{ success, data: { key, url, tipo, tamano } }`; `key` tiene forma `comprobantes/aaaa/mm/uuid.ext`.
3. Se guarda en la BD la `key`/`url` (nunca una URL de MinIO).
4. Se muestra con `GET /api/v1/archivos/<key>` (la API hace streaming; requiere sesión).
5. `DELETE /api/v1/archivos/<key>`: solo administrador.

Carpetas permitidas: `comprobantes`, `soportes`, `fotos`. En modo `local` los archivos quedan en `./almacenamiento-local` (ignorado por git).

## Salud

`GET /api/v1/health` (sin sesión, siempre 200): `{ modo, db: 'ok'|'error', almacenamiento: { driver, ok }, hora }`. Lo usa el healthcheck de Docker y `setup-back.sh`.

## Errores

Contrato único backend/frontend: `ESTANDAR_ERRORES.md` (raíz). Catálogo vivo: `GET /api/v1/info/errores`. Para depurar, buscar el `requestId` del error en el log.

## Actualizar el servidor

```bash
ssh -i molinos_oracle_ed25519 ubuntu@<ip-vm> 'sudo /opt/molinos/update.sh'
```
Hacerlo en `molinos-back` y luego en `molinos-front`. `update.sh` hace `git fetch/reset` de la rama configurada en `/opt/molinos/branches.env` (back: `feat/juliana-dev`) y llama a `setup-back.sh`, que arma `/opt/molinos/.env` (= `db.env` + `secrets.env` + `front_url.env`), reconstruye con `docker compose` y espera hasta 90 s el health.

## Poner la URL del front (una vez)

```bash
sudo nano /opt/molinos/front_url.env     # FRONT_URL=https://<ip-con-guiones>.sslip.io
sudo /opt/molinos/update.sh
```
Si el HTTPS falla, en ese mismo archivo `COOKIE_SECURE=false` (escape temporal).

## Logs

```bash
sudo docker compose -p molinos-back logs -f api
sudo docker compose -p molinos-back logs -f minio
```

## Contrato con cloud-init (no romper)

- Deben existir: `deploy/update.sh`, `deploy/back/setup-back.sh`, `deploy/back/docker-compose.yml` (con la palabra `HeatWave`) y `deploy/front/setup-front.sh` (wrapper que delega al repo del front).
- `/opt/molinos/db.env` lo pone cloud-init; `secrets.env` y `front_url.env` los crea `setup-back.sh`.
- El repo es público: cero secretos, cero `.env`, nunca `MolinosExport.sql`.

## Probar el modo oracle en tu PC (Docker Desktop)

```bash
docker compose --env-file .env -f deploy/back/docker-compose.yml -f deploy/back/docker-compose.prueba-local.yml up --build -d
curl http://localhost:3005/api/v1/health
docker compose -p molinos-back down
```
Solo pruebas locales: usa tu MySQL local vía `host.docker.internal` (pon `DB_PASSWORD` en tu `.env`).
