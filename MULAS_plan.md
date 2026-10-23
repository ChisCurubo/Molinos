# Plan — Mulas (transporte de concentrado a Barranquilla) y análisis de salida

> Rama `feat/con-front-Vicky`. Fecha: 2026-09-13 — **§3.1/§3.2 (CRUD + pago de Mulas) implementados**
> ese mismo día, ver §6. Cubre todo lo que pasa DESPUÉS de que el concentrado sale de la planta rumbo a
> Barranquilla: el despacho en mula, su pago, y los análisis de laboratorio que certifican tenor/peso
> hasta la liquidación final con Transfigura.
>
> **Actualizado 2026-09-19:** `migracion_viaje_estado_2026-09-13.sql` confirmada aplicada (los 17/17 de
> `tests/viaje_estado_mula.endpoints.test.mjs` el 2026-09-14 no pasarían sin `Viaje.estado` en la BD).
> El pendiente de "consumir `Saldo_A_Favor` del proveedor" (§6, §8) se detalla ahora en
> `PENDIENTE_CONSUMO_SALDO_A_FAVOR.md`. Lo que sigue realmente pendiente de este documento:
> `Peso_Final_Transfigura` (§3.3, cero código) y los tipos de análisis Colas/Concentrado_Colas/Colas_Colas
> (§3.4, sin lógica de negocio).

---

## 0. Resumen — qué existe y qué falta

| Pieza | Estado |
|---|---|
| `Viaje` (cabecera + `numero_viaje` ej. `13-5`) | ✅ CRUD completo |
| `viaje_material` (líneas: qué lotes van en cada viaje) | ✅ CRUD completo (asignar/editar/eliminar línea) |
| Trazabilidad viaje → lote → materiales de origen | ✅ implementada |
| **`Mulas`** (el despacho físico: proveedor transportador, factura, valor del flete) | ✅ **CRUD implementado** 2026-09-13 (`/pagos/mulas`) |
| **Vincular una Mula a un `Viaje`** (`Mulas.id_viaje`) | ✅ al crear (opcional) y editable via `PATCH /pagos/mulas/:id` |
| **Pago de Mulas** (retención `v_mulas`, saldo `v_estado_mulas`) | ✅ **implementado** 2026-09-13: CxP simple por despacho + abonos con tope/sobrepago (mismo patrón que material) — ver §6 |
| Análisis **Cabeza** (tipo 1, entrada) | ✅ implementado con cálculos de precio/costo |
| Análisis **Concentrado** (tipo 2, lote) | ✅ implementado (vincula al lote, define tenor de venta) |
| Análisis **Colas / Concentrado_Colas / Colas_Colas** (tipos 3/4/5) | ⚠️ el catálogo existe y el endpoint genérico los acepta, pero el service **no tiene ninguna rama de negocio para ellos** (a diferencia de tipo 1 y 2) — se insertan "a secas", sin validación ni efecto sobre nada |
| **`Peso_Final_Transfigura`** (peso/tenor certificado en destino: Infopath, SGS origen, Transfigura/Perú destino) | ❌ **CERO código** — solo existe la tabla y el modelo TS. Esta es la pieza que probablemente llamas "el análisis de Transfigura" |
| "Análisis del laboratorio de Medellín" | 🚫 **fuera de alcance** — el usuario decidió dejarlo sin implementar por ahora (Decisión 1, §4) |

**En una frase:** todo lo que pasa DENTRO de la planta (entrada → análisis Cabeza → proceso → concentrado
→ viaje) está construido. Todo lo que pasa DESDE que el concentrado sale en la mula hacia adelante
(despacho, pago del flete de la mula, certificación final de peso/tenor) **no tiene código, solo
esquema de BD**.

---

## 1. El flujo completo (de la mina a la liquidación)

```
Mina → Minero → material_planta_entrada → Análisis Cabeza (✅)
                        │
                        ▼
              procesamiento_material → material_concentrado (lote)
                        │                      │
                        │              Análisis Concentrado (✅, tenor de venta interno)
                        ▼
                  viaje_material  ◄── Viaje (numero_viaje ej. "13-5") (✅ CRUD completo)
                        │
                        ▼
                     Mulas  ◄── despacho físico a Barranquilla (❌ sin código)
                        │         (proveedor transportador, factura, valor flete)
                        ▼
              Peso_Final_Transfigura  ◄── certificación en destino (❌ sin código)
              (peso neto/seco, Infopath, SGS origen, tenor final Perú, arsénico)
```

`Mulas.id_viaje` es la costura entre el despacho físico y el viaje que ya armaste en `viaje_material`.
`Peso_Final_Transfigura.id_viaje` es la liquidación final de ESE viaje una vez Transfigura certifica en
destino — por eso `Viaje` ya tiene columnas para los datos "esperados" (`tenor_au_venta`,
`total_grs_au_venta`, `tenor_ag`, `total_grs_ag_venta`) que en teoría deberían terminar coincidiendo
(o no) con lo que `Peso_Final_Transfigura` certifica.

---

## 2. Qué existe hoy, tabla por tabla

### `Mulas` (línea 777 de `molinos_coments_v4.sql`)
`id_proveedor` (transportador, categoría `Transporte_Mula`) · `id_viaje` (NULL-able, `ON DELETE SET
NULL`) · `fecha` · `concepto` · `factura_num` · `foto_factura_url` · `valor` (flete bruto) ·
`comprobante_url`. Modelos TS: `models/pagos/{sql,app}/mula.*`.

### Vistas ya calculadas en BD
- `v_mulas`: agrega `pct_retencion`, `retencion`, `abono_neto` desde `Tarifas_Calculo` (código
  `retencion_mula_pct`, hoy 1.00%) — el mismo patrón de tarifa versionada que ya usa flete/agua.
- `v_estado_mulas`: `valor_total`, `total_pagado`, `saldo_pendiente`, `estado_pago` — vía
  `Cuentas_Por_Pagar_Relacion.id_mula` (columna que YA existe en el esquema, lista para usarse).
- Ambas están leídas hoy solo por `VEstadoMulasRepository` → `DeudaService.getMulas()` →
  `GET /pagos/vistas/estado-mulas` (dashboard). Nadie las alimenta con datos reales porque no hay forma
  de crear una `Mula` ni su `Cuentas_Por_Pagar_Relacion`.

### `Peso_Final_Transfigura` (línea 979)
`id_viaje` · `fecha` · `peso_neto` / `peso_seco` · `infopath_au` / `infopath_ag` (medición interna) ·
`tenor_inicial_sgs_{au,ag,cu}` (certificación de origen) · `tenor_final_peru_{au,ag}` +
`arsenico_final_peru` (certificación de destino/definitiva). Modelos TS:
`models/material/{sql,app}/peso_final_transfigura.*`. Cero uso en ningún repository/service/controller.

### `Tipos_Analisis` (línea 121) y `Analisis` (línea 705)
5 tipos: `Cabeza`, `Concentrado`, `Colas`, `Concentrado_Colas`, `Colas_Colas`. El service
(`analisis.service.ts`) solo ramifica por `id_tipo_analisis === 1` (Cabeza) y `=== 2` (Concentrado) —
son las únicas dos con lógica real (validaciones propias, disparan recálculo de precio/costo o fijan el
tenor de venta del lote). Los otros 3 tipos se pueden insertar vía el endpoint genérico `POST
/material/analisis` pero sin ninguna validación ni efecto — quedan como un registro suelto.

---

## 3. Piezas que faltan, en detalle

### 3.1 CRUD de `Mulas` (despacho físico)
No existe `ports/pagos/{repository_port,service_port}/mula.*`, ni repository, ni service, ni
controller, ni rutas. Necesita, como mínimo:
- `POST /pagos/mulas` — crear despacho (`id_proveedor`, `fecha`, `concepto`, `factura_num`,
  `foto_factura_url`, `valor`; `id_viaje` opcional).
- `GET /pagos/mulas` (listar, filtro por viaje/proveedor/fecha) · `GET /pagos/mulas/:id`.
- `PATCH /pagos/mulas/:id` — incluye poder **vincular/desvincular el viaje** (`id_viaje`).
- `DELETE /pagos/mulas/:id`.

### 3.2 Pago de Mulas — ✅ diseño cerrado (Decisión 2)

**Regla de negocio (tal como la explicó el usuario, con el ajuste del 2026-09-13):** la empresa
transportadora manda la cuenta de cobro y **se paga lo que esa cuenta de cobro dice, siempre** — el
sistema no corrige ni bloquea el pago. Pero el transportador a veces se equivoca al facturar — de menos
O de más — y eso hay que dejarlo visible para que contabilidad no se lleve una sorpresa después.

**Flujo real en el front al registrar un despacho** (esto es lo que ya usan/van a usar en pantalla):
1. Sube la **foto de la factura** que le mandó el transportador (`foto_factura_url`, ya existe).
2. Escribe **"la cantidad que es"** — el valor correcto/real que corresponde a ese despacho según lo
   pactado (la referencia interna de cuánto DEBERÍA ser).
3. Escribe **"la cantidad que paga"** — el valor que efectivamente se va a pagar, es decir, lo que
   dice la factura recibida (puede o no coincidir con el punto 2 si el transportador se equivocó).
4. Sube el **comprobante de pago** (`comprobante_url`, ya existe) una vez pagado.

Mapeo a `Mulas`:
- **`valor` (ya existe):** pasa a representar la **cantidad que se paga** (lo que dice la factura y lo
  que realmente sale de caja). Es la base para la CxP/Abono — el pago nunca se ajusta ni se bloquea por
  la diferencia.
- **`valor_correcto` (nuevo, a definir en la migración):** la **cantidad que es** — el valor real/pactado
  para ese despacho, capturado manualmente por quien registra (no hay tarifa de mulas modelada todavía
  para calcularlo solo, a diferencia del flete de volqueta).
- **`diferencia` (derivada):** `valor_correcto − valor`. **Positiva** = facturaron/pagaron de MENOS de
  lo que correspondía (descuadre a favor del transportador). **Negativa** = facturaron/pagaron de MÁS
  (descuadre en contra de la empresa) — el usuario confirmó que este caso **también** debe quedar
  marcado, no solo el de "de menos". Se muestra en el detalle y en un listado/alerta de mulas con
  `diferencia ≠ 0`, en cualquier dirección, sin afectar el pago real.

Flujo de pago (sin cascada, CxP simple — parte no controvertida de la Decisión 2):
- Al crear la Mula (o en un endpoint separado "generar CxP"), abrir una `Cuentas_Por_Pagar` categoría
  'Mula' por el `abono_neto` de `v_mulas` (`valor` − retención) + su `Cuentas_Por_Pagar_Relacion.id_mula`.
- Abonos normales, sin cascada por dueño/mes (cada despacho es puntual).

**Hallazgo colateral (sigue vigente, aplica a esto):** el `cxp.repository.ts` genérico
(`POST /pagos/cxp`) **no crea ninguna `Cuentas_Por_Pagar_Relacion`** — hoy no hay forma de pagar una Mula
NI un Análisis (`id_analisis`) por ningún endpoint existente. Hay que resolver esto (generalizar la
creación de `Relacion`) como parte de este mismo trabajo.

### 3.3 `Peso_Final_Transfigura` (probablemente tu "análisis de Transfigura") — ✅ diseño cerrado (Decisión 4)
Cero código. Necesita, como **upsert 1:1 por viaje** (mismo patrón que `Excedente`, sin `UNIQUE` en BD —
la unicidad la garantiza el service: si ya existe un registro para ese `id_viaje` lo actualiza, si no
existe lo crea):
- `PUT /material/viajes/:id/peso-final` — crea o actualiza la certificación de destino de ese viaje.
- `GET /material/viajes/:id/peso-final` — detalle (404 si aún no se ha certificado).
- Posible comparación automática: `Viaje.tenor_au_venta`/`total_grs_au_venta` (lo que Transfigura
  reconoció "en papel" al momento del viaje) vs `tenor_final_peru_au` (lo que se certificó en destino
  finalmente) — sería el reporte de diferencias que le importa al negocio para saber si perdieron o
  ganaron metal en el trayecto.

### 3.4 Tipos de análisis sin lógica (Colas / Concentrado_Colas / Colas_Colas)
Existen en el catálogo pero el service no los trata. Si se reprocesan colas y de ahí sale un nuevo lote
de concentrado, hoy no hay ninguna ruta clara de cómo eso se conecta con `material_concentrado` /
`procesamiento_material` (que hoy asumen que el material viene siempre de `material_planta_entrada`).
Necesita definirse si es un flujo real que se usa o si por ahora es solo catálogo para análisis
informativos sin efecto en inventario.

### 3.5 Transversal
Registrar `/pagos/mulas/*` y lo que salga de `Peso_Final_Transfigura` en `info.controller` (API_MAP) y
en el Postman — mismo pendiente que ya arrastran flete/agua/combustible/anticipos.

---

## 4. Decisiones — CERRADAS (2026-09-13)

| # | Decisión | Cerrada | Por qué / cómo aplicar |
|---|----------|---------|-------------------------|
| 1 | **"Análisis del laboratorio de Medellín"** | **Fuera de alcance por ahora — no se implementa.** | El usuario decidió dejarlo sin resolver/implementar. No aparece en el esquema actual; si se retoma en el futuro habrá que definirlo desde cero (probablemente un tipo nuevo en `Tipos_Analisis` o aclarar si es Peso_Final_Transfigura con otro nombre). |
| 2 | **Pago de Mulas: ¿cascada o CxP simple?** | **CxP simple** (sin agrupar por dueño+mes) **+ captura de 2 montos + control de discrepancia bidireccional** — ver diseño en §3.2 actualizado. | Se paga siempre lo que dice la cuenta de cobro (no se recalcula ni se fuerza a un valor "correcto"), pero el transportador a veces se equivoca — de menos O de más — el sistema debe **dejar visible la diferencia en cualquier dirección**, sin bloquear el pago. El front ya captura ambos montos al registrar el despacho. |
| 3 | **Formato de `numero_viaje`** | **Se deja como texto libre**, sin validación de patrón ni autogeneración. | Es como funciona hoy; no se justifica el trabajo adicional. |
| 4 | **`Peso_Final_Transfigura` 1:1 o histórico** | **1 registro por viaje.** | Más simple: una corrección se aplica actualizando el registro existente (upsert), no creando uno nuevo — mismo patrón que ya usa `Excedente` (`PUT` upsert 1:1, ver `fase3-precio-gastos-excedente`). La unicidad se garantiza en el service (find-or-fail-then-update / insert-if-none), no con un `UNIQUE` en BD. |

---

## 5. Orden sugerido de implementación (decisiones ya cerradas, ver §4)

1. ✅ **CRUD de `Mulas`** (§3.1) — implementado 2026-09-13, ver §6.
2. ✅ **Pago de Mulas** (§3.2) — implementado 2026-09-13, ver §6. El hueco de `cxp.repository`
   genérico (§3.2 original) **no se tocó** — se resolvió con SQL propio dentro de `pago_mula.repository`
   (mismo patrón que material/flete/agua, cada módulo dedicado tiene su propio acceso a
   `Cuentas_Por_Pagar_Relacion`). El pago de Análisis sigue sin resolver, ese hueco genérico sigue ahí.
3. **`Peso_Final_Transfigura`** (§3.3) — `PUT` upsert 1:1 por viaje. Cierra el ciclo de liquidación.
   **Siguiente pieza a construir.**
4. **Colas/Concentrado_Colas/Colas_Colas** (§3.4) — sigue pendiente de decidir si es un flujo real usado
   hoy en la operación (no se cerró en esta ronda de preguntas).
5. Transversal: API_MAP + Postman (§3.5) — incluir `/pagos/mulas/*` cuando se haga esta pasada.

**Fuera de alcance por ahora:** "análisis del laboratorio de Medellín" (Decisión 1) — no se implementa.

---

## 6. Pago de Mulas — implementado (2026-09-13)

Módulo `/pagos/mulas`, mismo patrón hexagonal completo (`repository_port`+`service_port` desde el
inicio, ver [[ports-service-faltantes-pagos]]):
`ports/pagos/{repository_port,service_port}/pago_mula.*` · `repositories/pagos/pago_mula.repository.ts` ·
`services/pagos/pago_mula.service.ts` · `controllers/pagos/pago_mula.controller.ts` ·
`routes/pagos/pago_mula.routes.ts` — wireado en `pagos.factory.ts` y `routes.pagos.ts`. Compila limpio
(`npx tsc --noEmit`).

**Esquema:** `migracion_mulas_2026-09-13.sql` agrega a `Mulas`: `valor_correcto` ("la cantidad que es",
manual) y `diferencia` (columna generada `valor_correcto − valor`, positiva = cobraron de menos,
negativa = cobraron de más). **Superado el mismo día por §8**: `migracion_mulas_ajuste_pago_2026-09-13.sql`
elimina ambas columnas — el diseño final NO las tiene, ver §8. `molinos_v4.sql`/`molinos_coments_v4.sql`
ya reflejan el estado final (sin `valor_correcto`/`diferencia`).

**Endpoints:**
```
POST   /pagos/mulas                 → crear despacho { id_proveedor, valor, valor_correcto?, fecha?, id_viaje?, concepto?, factura_num?, foto_factura_url?, comprobante_url? }
GET    /pagos/mulas/resumen?desde=&hasta=&id_proveedor=   → KPIs del período (despachos, facturado, retenido, pagado, pendiente, descuadres)
GET    /pagos/mulas?id_proveedor=&id_viaje=&estado=&con_diferencia=true
GET    /pagos/mulas/:id             → detalle + cuenta + abonos
PATCH  /pagos/mulas/:id             → editar (incl. vincular/desvincular id_viaje; si cambia valor, recalcula el neto de la CxP)
DELETE /pagos/mulas/:id             → elimina todo (solo si la CxP no tiene abonos)
POST   /pagos/mulas/:id/abonos      → abonar (tope al saldo + sobrepago → Saldo_A_Favor del proveedor)
PATCH  /pagos/mulas/abonos/:idAbono
DELETE /pagos/mulas/abonos/:idAbono
GET    /pagos/mulas/abonos?id_proveedor=&desde=&hasta=&metodo_pago=&page=&limit=
```

**Al crear una Mula (todo en una transacción):**
1. Inserta `Mulas` con `valor` (la cantidad que paga) y `valor_correcto` opcional (la cantidad que es).
2. Calcula el neto: `valor − valor × retencion_mula_pct/100` (mismo cálculo que la vista `v_mulas`,
   tarifa `Tarifas_Calculo.codigo='retencion_mula_pct'`).
3. Abre una `Cuentas_Por_Pagar` categoría 'Mula' (beneficiario = `id_proveedor`) por ese neto, **sin
   cascada** (1 despacho = 1 CxP, a diferencia de flete/agua que agrupan por dueño+mes) + su
   `Cuentas_Por_Pagar_Relacion.id_mula`.

**Abonos:** en vez de bloquear el sobrepago con un error, sigue el patrón ya usado en
`pago_material` — el abono se capa al saldo pendiente y el excedente genera automáticamente un
`Saldo_A_Favor` (`origen='pago_excedido'`, beneficiario `id_proveedor`) que el transportador puede
consumir después (consumo aún no implementado en ningún módulo de pagos salvo material — ver
`PENDIENTE_CONSUMO_SALDO_A_FAVOR.md`).

**Listado de mulas** (`GET /pagos/mulas`) hace `JOIN` directo contra las vistas `v_mulas` (retención/
neto) y `v_estado_mulas` (pagado/saldo/estado) que ya existían en BD — no se reimplementó ese cálculo.
El filtro `con_diferencia=true` muestra solo despachos con `diferencia ≠ 0` (la alerta de descuadre).

**Probado contra BD real: 32/32 OK** (`tests/pago_mula.endpoints.test.mjs`). En el camino se corrigió
`v_estado_mulas` (calculaba el saldo sobre `Mulas.valor` bruto en vez del neto real de la CxP — ver el
bloque `CREATE OR REPLACE VIEW` al final de `migracion_mulas_2026-09-13.sql`).

---

## 7. Selector de viajes + estado del Viaje (2026-09-13, mismo día)

Al usar Mulas en el front, hacía falta un selector de "qué viajes puedo despachar" y que el Viaje
reflejara que ya salió. **Decisión del usuario:** el Viaje se marca despachado al **registrar** la
mula (el material sale físicamente ese día, sin importar cuándo se termine de pagar la factura).
Estados: `almacenado` (nace así, con o sin líneas) → `despachado` (tiene una Mula vinculada).

- Migración `migracion_viaje_estado_2026-09-13.sql`: `Viaje.estado ENUM('almacenado','despachado')
  NOT NULL DEFAULT 'almacenado'` + índice. **✅ Aplicada** (confirmado 2026-09-19 por los tests de abajo).
- `GET /material/viajes/disponibles-mula` — selector: viajes en `almacenado` que además tienen
  **al menos una línea** (`viaje_material`, o sea carga real asignada) — devuelve
  `{ id, numero_viaje, fecha, estado, num_lineas, toneladas_seco }`.
- `PagoMulaService` mantiene el estado automáticamente, sin trigger:
  - Al **crear** una Mula con `id_viaje`: valida que el viaje exista y no esté ya `despachado` (409 si
    lo está) → lo marca `despachado`.
  - Al **editar** (`PATCH .../mulas/:id`) y cambiar `id_viaje` (vincular otro, o `null` para
    desvincular): revierte el viaje anterior a `almacenado` y valida/despacha el nuevo.
  - Al **eliminar** una Mula (sin abonos) que tenía `id_viaje`: revierte ese viaje a `almacenado`.
- **Probado: 17/17 OK** (`tests/viaje_estado_mula.endpoints.test.mjs`, corrido 2026-09-14 —
  ver `docs/pruebas/REPORTE_PRUEBAS_VIAJE_ESTADO_MULA_2026-09-14.md`).

---

## 8. Rediseño del pago de Mulas (mismo día, tras probar en el front)

Al conectar el front, el usuario pidió simplificar el registro y pasar los abonos a cascada:

1. **Al registrar la mula ya NO se pide `valor` (lo que se paga) ni `comprobante_url`.** Solo se
   captura la DEUDA — el campo `valor` pasa a significar "lo que se debe pagar" (antes de retención).
   El pago real (con su comprobante) se registra después, en los abonos. Se retira el control de
   discrepancia bidireccional (`valor_correcto`/`diferencia`, §3.2 anterior): ya no hace falta —
   el saldo de la CxP revela solo, de forma natural, si se pagó de más (→ `Saldo_A_Favor`) o de
   menos (→ queda como saldo pendiente).
   - Migración `migracion_mulas_ajuste_pago_2026-09-13.sql`: DROP de `valor_correcto`/`diferencia` +
     nuevo comentario en `valor`. Estado de aplicación irrelevante en la práctica (el código ya no usa
     esas columnas exista o no); solo cosmético si sigue sin correr — pendiente menor, no bloqueante.
2. **Los abonos pasan a ser en CASCADA por proveedor**, igual que flete/agua: `POST
   /pagos/mulas/proveedor/:idProveedor/abonos` reemplaza al viejo `POST /pagos/mulas/:id/abonos`.
   Un solo abono (ej. $10.000.000) se aplica del despacho más viejo al más nuevo entre TODAS las
   cuentas de mula abiertas de ese proveedor, hasta agotarse; el sobrante genera `Saldo_A_Favor`.
3. **Nuevo `GET /pagos/mulas/viajes`** — trazabilidad: por cada mula-con-viaje, su proveedor, su
   cuenta y sus abonos completos. Responde "qué hemos abonado, a qué viaje y a qué proveedor".

**Probado end-to-end: 27/27 OK** (`tests/pago_mula.endpoints.test.mjs`, reescrito para el modelo v2) —
cubre la cascada aplicando un abono sobre 2 despachos, un segundo abono que termina uno + paga otro +
genera sobrepago, y la trazabilidad por viaje. `tests/viaje_estado_mula.endpoints.test.mjs` (17/17) y
`tests/proveedor.endpoints.test.mjs` (13/13) siguen pasando sin cambios.
