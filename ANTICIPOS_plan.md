# Plan — Anticipos a terceros (adelantos de dinero)

> Rama `feat/con-front-Vicky`. Fecha: 2026-09-06, decisiones cerradas 2026-09-13,
> **Fase 1 (módulo standalone) implementada 2026-09-13** — ver §0 para qué falta y §7 para el detalle.
> Diseño para implementar los anticipos a **minero / dueño de volqueta / proveedor**: la empresa le
> adelanta dinero al tercero y ese monto se **descuenta de pagos futuros**.
>
> **Actualizado 2026-09-19:** `migracion_anticipos_terceros_2026-09-13.sql` ya se aplicó en BD (punto 1
> de abajo, cerrado). La Fase 2 (punto 3) se detalla ahora en un archivo propio:
> **`PENDIENTE_CONSUMO_SALDO_A_FAVOR.md`**.

---

## 0. Estado actual — qué falta (leer esto primero)

**✅ Fase 1 — módulo standalone `/pagos/anticipos`: IMPLEMENTADA.** Crear / listar / detalle / anular
un anticipo ya funciona en código (compila limpio, `npx tsc --noEmit`). Ver §7 para el detalle de qué se
construyó y cómo.

**⏳ Falta, en orden, antes de dar esto por cerrado:**

1. ~~Aplicar `migracion_anticipos_terceros_2026-09-13.sql` en la base de datos.~~ **✅ Aplicada
   (confirmado 2026-09-19).** Agregó `'anticipo'` a `Saldo_A_Favor.origen` + columna `id_anticipo`,
   `'anulado'` a `Anticipos_Terceros.estado`, y generalizó `Historial_Descuentos_Anticipos`.
2. **Probar el flujo de creación/anulación contra la BD real** ahora que la migración ya está aplicada
   (crear un anticipo de prueba, verificar que se abre y paga la CxP, que aparece el espejo en
   `Saldo_A_Favor`, y que anular revierte las 4 tablas). Sigue sin existir `tests/anticipo*.test.mjs`
   (a diferencia de flete/agua/material/mulas/combustible, todos con 20+ checks) — **sigue pendiente**.
3. **Fase 2 — incorporar el consumo al sistema.** Ver el diseño completo, el estado verificado en código
   y la lista de qué construir en **`PENDIENTE_CONSUMO_SALDO_A_FAVOR.md`** (nuevo, 2026-09-19) — resuelve
   a la vez el pendiente viejo "consumir saldo a favor en flete/agua" (§6 de este doc / §4 de
   `SALDO_A_FAVOR_2026-09-01.md`), porque es el mismo mecanismo genérico para ambos orígenes de crédito.
4. **Registrar cada descuento en `Historial_Descuentos_Anticipos`** — parte de la Fase 2, ver el archivo
   de pendiente. Hoy la tabla existe generalizada pero nada escribe en ella todavía.
5. **Nice-to-have, no bloqueante:** registrar `/pagos/anticipos/*` en `info.controller` (API_MAP) y en
   el Postman (`Molinos_API_Postman_Collection.json`) — mismo pendiente transversal que ya existe para
   Mulas y Proveedores.

---

## 1. Qué es y qué existe hoy

**Un anticipo es un crédito a favor de la empresa contra el tercero:** le adelantas plata y luego, cuando
le pagas (material al minero, flete/agua al dueño, deuda al proveedor), le descuentas del pago hasta
consumir el anticipo. Es la **misma mecánica que el "saldo a favor"** que ya construimos, con otro origen
(el saldo a favor nace de un sobrepago accidental; el anticipo lo creas a propósito).

### Ya existe (esquema + modelos, sin endpoints)
- Tabla **`Anticipos_Terceros`** (`molinos_coments_v4.sql` ~667): `id_minero | id_dueno_volqueta |
  id_proveedor` (exactamente uno, CHECK `chk_anticipo_tercero`), `monto_inicial`, `monto_usado`,
  `saldo_disponible` STORED (= inicial − usado), `estado` (`disponible`/`agotado`), `fecha`, `descripcion`.
- Tabla **`Historial_Descuentos_Anticipos`** (~690): auditoría de cada descuento. **⚠️ hoy solo enlaza
  `id_entrada` NOT NULL → material_planta_entrada** (ver Decisión 2).
- Modelos TS: `src/models/material/{sql,app}/anticipo_tercero.*`, `.../historial_descuento_anticipo.*`.
- Redundancia en el esquema: el anticipo también aparece como `id_anticipo` en `Cuentas_Por_Cobrar`
  (categoría 'Anticipo') y en `Cuentas_Por_Pagar_Relacion` (ver Decisión 4).

---

## 2. El flujo (2 partes)

1. **Crear el anticipo** — sale dinero real al tercero. Se registra en `Anticipos_Terceros`
   (`saldo_disponible = monto_inicial`).
2. **Descontarlo de pagos futuros** — al abonar una CxP de ese tercero (material/flete/agua/deuda
   proveedor), una porción se paga "con anticipo" en vez de efectivo: baja `saldo_disponible`, sube
   `monto_usado`, se audita, y el `estado` pasa a `agotado` cuando llega a 0.

---

## 3. Diseño recomendado

**Reusar el motor de "crédito del tercero" de la cascada de abonos** (el mismo que consume `Saldo_A_Favor`
en material). Un anticipo se comporta como un crédito pre-cargado del tercero:

- **Consumo al pagar:** un `Abonos_CxP` con `metodo_pago='saldo_a_favor'` (Decisión 1 — no se agrega
  `'anticipo'` al ENUM) que NO mueve efectivo, referencia el anticipo y baja su `saldo_disponible`. Un
  anticipo y un sobrepago accidental terminan consumiéndose exactamente igual en la cascada de abonos;
  la diferencia entre ambos vive solo en el origen del crédito (`Anticipos_Terceros` vs `Saldo_A_Favor`),
  no en cómo se gasta.
- **Beneficio doble:** esto es la MISMA maquinaria que el pendiente "consumir saldo a favor en flete/agua".
  Construir un **consumo de crédito genérico por tercero** (minero/dueño/proveedor) que cubra
  `Saldo_A_Favor` **y** `Anticipos_Terceros` resuelve ambos de una sola vez y queda uniforme con
  material/flete/agua.
- **Creación del anticipo (egreso):** al crear el anticipo se abre una `Cuentas_Por_Pagar` categoría
  'Anticipo' por `monto_inicial` y se abona de inmediato con un `Abonos_CxP` normal
  (`metodo_pago='efectivo'`/`'transferencia'`, el que se use realmente) — así el egreso queda en el mismo
  libro que material/flete/agua/proveedor y "cuánto salió este mes" se puede sumar sin mirar una tabla
  aparte (Decisión 3). `Anticipos_Terceros` sigue siendo la tabla de **saldo disponible a descontar**;
  la CxP de creación es solo el registro contable de la salida de plata.

### Módulo `/pagos/anticipos/*` — ✅ IMPLEMENTADO (Fase 1, ver §7)
```
POST   /pagos/anticipos                 → crear anticipo { tercero (minero|dueno_volqueta|proveedor), id, monto, comprobante_url, fecha?, metodo_pago?, descripcion? }
GET    /pagos/anticipos?tercero=&id=&estado=  → listar (con saldo_disponible/estado)
GET    /pagos/anticipos/:id             → detalle + historial de descuentos
DELETE /pagos/anticipos/:id             → anular (solo si monto_usado = 0)
```
⏳ **Falta todavía:** en la cascada de abonos existente (flete/agua/material), permitir aplicar el
crédito del tercero (anticipo + saldo a favor) como parte del abono — esto es la Fase 2, ver §0.3.

---

## 4. Decisiones — CERRADAS (2026-09-13)

| # | Decisión | Cerrada | Por qué |
|---|----------|---------|---------|
| 1 | **Cómo se consume al pagar** | Reusar `metodo_pago='saldo_a_favor'` en `Abonos_CxP`. **No** se agrega valor `'anticipo'` al ENUM — sin ALTER. | El consumo es idéntico al de un sobrepago; solo cambia de dónde sale el crédito. Un único mecanismo de consumo para ambos orígenes. |
| 2 | **Auditoría del descuento** | Generalizar `Historial_Descuentos_Anticipos`: `id_entrada` pasa a NULLable + se añade `id_abono_cxp INT NULL FK Abonos_CxP`. | Hoy solo enlaza a `material_planta_entrada`; debe servir también para flete/agua/proveedor. |
| 3 | **Cómo se refleja el egreso al CREAR el anticipo** | Se abre una `Cuentas_Por_Pagar` categoría 'Anticipo' por `monto_inicial` y se abona de inmediato (`Abonos_CxP` normal, método real usado: efectivo/transferencia). | Mismo flujo contable que material/flete/agua/proveedor; el total de plata que sale en un período se puede sumar sin mirar una tabla aparte. `Anticipos_Terceros` sigue llevando el saldo disponible a descontar. |
| 4 | **Redundancia con `Cuentas_Por_Cobrar` (cat. 'Anticipo')** | **No** se reusa `Cuentas_Por_Cobrar`. `Anticipos_Terceros` queda como modelo independiente. | CxC es plata que la empresa **debe cobrar** (de sus clientes); un anticipo es plata que la empresa **adelanta** a un tercero (minero/dueño/proveedor) y luego descuenta — la dirección del dinero es opuesta, no es el mismo concepto. |

---

## 5. Cambios de esquema previstos (cuando se implemente)
- Sin ALTER a `Abonos_CxP.metodo_pago` (Decisión 1: se reusa `'saldo_a_favor'`).
- (Decisión 2) `Historial_Descuentos_Anticipos`: `id_entrada` NULLable + `id_abono_cxp INT NULL FK Abonos_CxP`.
- (Decisión 3) Alta de un anticipo = 1 fila en `Cuentas_Por_Pagar` (categoría 'Anticipo') + 1 `Abonos_CxP`
  que la salda de inmediato, dentro de la misma transacción que crea la fila en `Anticipos_Terceros`.
- `Anticipos_Terceros.monto_usado`/`estado`: los mantiene el service (mismo patrón que Saldo_A_Favor: no triggers).

## 6. Relación con lo ya hecho
- Reusa el patrón de `Saldo_A_Favor` (`crearSaldoAFavorDueno`, `aplicarACredito`, guards editar/eliminar) —
  ver `SALDO_A_FAVOR_2026-09-01.md` y los servicios `pago_flete`/`pago_agua`/`pago_material`.
- Cierra de paso el pendiente "consumir saldo a favor en flete/agua" si se hace el consumo genérico.
- Beneficiario por tercero: minero (material), dueño de volqueta (flete/agua), proveedor (deuda proveedor).

---

## 7. Fase 1 implementada (2026-09-13) — qué se construyó y cómo

**Hallazgo al implementar la Decisión 1:** el ENUM `Saldo_A_Favor.origen` no tenía valor `'anticipo'`, y
el CHECK `chk_saldo_favor_metodo` de `Abonos_CxP` exige `id_saldo_favor` real (una fila que existe en
`Saldo_A_Favor`) para poder usar `metodo_pago='saldo_a_favor'`. Sin esa fila, la Decisión 1 no se podía
cumplir tal cual. Se resolvió con la opción **"espejo"**: al crear un anticipo se crea también una fila en
`Saldo_A_Favor` (`origen='anticipo'`, nueva columna `id_anticipo` FK a `Anticipos_Terceros`) — ese espejo
es el crédito que de verdad se consume después, reutilizando el 100% del código de saldo a favor que ya
existe y está probado en flete/agua (`aplicarACredito`, `obtenerCreditosDisponiblesDueno`, etc.), sin
escribir un mecanismo de consumo nuevo. `Anticipos_Terceros.monto_usado`/`estado` se mantienen en paralelo
por el service como el registro de negocio (igual patrón que las demás tablas de este dominio: sin
triggers, todo en la app).

**Migración de esquema:** `migracion_anticipos_terceros_2026-09-13.sql` (✅ aplicada 2026-09-19, ver §0.1):
- `Saldo_A_Favor.origen` ENUM +`'anticipo'`, + columna `id_anticipo` NULL FK + CHECK de consistencia.
- `Anticipos_Terceros.estado` ENUM +`'anulado'` (para poder cancelar un anticipo recién creado).
- `Historial_Descuentos_Anticipos`: `id_entrada` pasa a NULLable + columna `id_abono_cxp` NULL FK
  (Decisión 2). `molinos_coments_v4.sql` ya quedó actualizado con estos mismos cambios documentados.

**Qué hace `POST /pagos/anticipos` (todo en una transacción):**
1. Inserta `Anticipos_Terceros` (`monto_inicial=monto`, `monto_usado=0`, `estado='disponible'`).
2. Abre `Cuentas_Por_Pagar` categoría 'Anticipo' por el mismo monto (Decisión 3) + su
   `Cuentas_Por_Pagar_Relacion.id_anticipo`.
3. La paga de inmediato con un `Abonos_CxP` real (`comprobante_url` obligatorio, igual que en
   flete/agua/material) y recalcula la cuenta (queda en estado `pagado`).
4. Crea el espejo en `Saldo_A_Favor` (`origen='anticipo'`, `id_anticipo`, `monto_original=monto`,
   `estado='disponible'`).

`DELETE /pagos/anticipos/:id` reversa las 4 escrituras (borra el espejo en `Saldo_A_Favor`, anula la CxP
con `deleted_at`, marca el anticipo `estado='anulado'`) — solo si `monto_usado = 0` y el espejo no se ha
aplicado (`monto_aplicado = 0`), es decir, si nada lo ha consumido todavía.

**Archivos creados** (patrón completo con `service_port` desde el inicio, sin repetir el olvido de
`ports-service-faltantes-pagos`):
`ports/pagos/repository_port/anticipo.repository.interface.ts` · `ports/pagos/service_port/anticipo.service.interface.ts` ·
`repositories/pagos/anticipo.repository.ts` · `services/pagos/anticipo.service.ts` ·
`controllers/pagos/anticipo.controller.ts` · `routes/pagos/anticipo.routes.ts` — wireado en
`pagos.factory.ts` y `routes.pagos.ts`. Compila limpio (`npx tsc --noEmit`, salvo el `test_deuda.ts`
conocido). **Sin probar contra BD real ni con tests de endpoint** — eso es lo primero de §0.
