# Saldo a favor (crédito por sobrepago)

> Documento de referencia (NO es código). Fecha: 2026-09-01. Rama: `feat/con-front-Vicky`.
> Qué es, cómo funciona en la BD, cómo se implementó en **material** y cómo replicarlo en flete/agua.

---

## 1. Qué es

Cuando le pagas a alguien **más de lo que le debes**, ese exceso no se pierde: queda como un
**crédito a su favor** (`saldo a favor`). Ese crédito se puede **descontar** de un pago futuro del
mismo tercero, o **devolver** en efectivo. Ejemplo: al minero le debes $5.6M y le transfieres $6M →
$400.000 quedan como crédito para su próxima cuenta.

El crédito es **del tercero (minero / dueño de volqueta), no de una cuenta puntual** — por eso se
puede usar en cualquier cuenta suya.

---

## 2. Cómo funciona en la BD

### Tabla `Saldo_A_Favor` (Módulo 13, `molinos_coments_v4.sql` ~1235)

| Columna | Rol |
|---|---|
| `origen` | `pago_excedido` (un abono pagó de más) o `ajuste_manual`. |
| `id_abono_cxp_orig` | El `Abonos_CxP` que generó el sobrepago (para poder revertir). |
| `id_minero` / `id_dueno_volqueta` / `id_proveedor` / `id_empleado` | **Beneficiario** (exactamente uno; lo obliga un CHECK). Es a quién pertenece el crédito. |
| `id_cuenta_pagar` | La cuenta que se sobrepagó (procedencia; el crédito NO queda atado a ella). |
| `monto_original` | El exceso pagado. |
| `monto_aplicado` | Cuánto de ese crédito ya se usó/devolvió. |
| `saldo_disponible` | **STORED** = `monto_original − monto_aplicado`. Crédito que queda. |
| `tipo_resolucion` | `pendiente` / `descontar_futuro` / `devolucion`. |
| `estado` | `disponible` / `parcial` / `agotado` / `devuelto`. |

### Cómo se usa el crédito: `Abonos_CxP.metodo_pago = 'saldo_a_favor'`

Un abono puede pagarse con crédito en vez de efectivo. La BD lo liga con:
- `Abonos_CxP.id_saldo_favor` → `Saldo_A_Favor.id`.
- CHECK `chk_saldo_favor_metodo`: `(metodo_pago='saldo_a_favor') = (id_saldo_favor IS NOT NULL)`.
  Es decir: un abono de tipo saldo_a_favor **debe** referenciar el crédito que consume, y cualquier
  otro método **no** puede referenciarlo.

### Vista `v_saldos_a_favor_disponibles` (~1374)

Lista los créditos con `estado IN ('disponible','parcial')` con nombre y tipo de beneficiario.
Ya se expone en `GET /pagos/vistas/saldos-a-favor`.

### Flujo de sobrepago documentado en el esquema (~1538)
1. Se detecta exceso al abonar. 2. `INSERT Saldo_A_Favor` (monto_original = exceso). 3a. Devolución
(estado='devuelto' + ingreso en Deposito) **o** 3b. Descontar en el próximo abono con
`metodo='saldo_a_favor'`.

> El trigger `trg_after_abono_cxp` que haría esto **está Pendiente**; la lógica vive en el **service**.

---

## 3. Cómo se implementó (MATERIAL — ya en código, 2026-09-01)

Todo transaccional en `PagoMaterialService` (`src/services/pagos/pago_material.service.ts`).

### 3.1 Generar crédito al sobrepagar
`POST /pagos/material/:id/abonos` con `valor > saldo`:
- La porción que cubre la cuenta se guarda como abono normal → la cuenta queda **pagada**.
- El **excedente** (`valor − saldo`) crea un `Saldo_A_Favor` del minero
  (`origen='pago_excedido'`, `id_abono_cxp_orig`, `id_cuenta_pagar`, `tipo_resolucion='descontar_futuro'`).
- Respuesta: `{ abono, cuenta, saldo_a_favor_generado, id_saldo_favor }`.

```
saldo cuenta = 5.600.000 ; abono = 6.000.000
   → abono aplicado = 5.600.000 (cuenta PAGADA)
   → Saldo_A_Favor(minero, monto_original = 400.000)
```

### 3.2 Consumir el crédito
Dos entradas, ambas consumen **del crédito más viejo primero** (cascada):
- **Al abonar:** `POST /pagos/material/:id/abonos` con `{ "metodo_pago": "saldo_a_favor" }`
  (sin comprobante; `valor` opcional = tope, si se omite aplica lo máximo posible). Inserta abonos
  `metodo='saldo_a_favor'` con `id_saldo_favor` y sube `Saldo_A_Favor.monto_aplicado`.
- **Al crear la cuenta:** `POST /pagos/material` con `{ "aplicar_saldo_a_favor": true }` → descuenta
  el crédito disponible del minero contra la cuenta recién creada.

### 3.3 Reglas de consistencia (editar/eliminar)
- **Editar** un abono que **generó** o **usó** crédito → **bloqueado** (409): hay que eliminarlo y rehacerlo.
- **Eliminar** un abono `saldo_a_favor` → **devuelve** el crédito al minero (`monto_aplicado −= valor`).
- **Eliminar** un abono que generó crédito → si el crédito está **sin usar**, se borra el `Saldo_A_Favor`;
  si ya se **usó** en otra cuenta → **409** (revierte primero ese descuento).

### 3.4 Exponerlo en la UI
`GET /pagos/deuda/material/minero/:id` devuelve:
```jsonc
{ "id_minero": 2, "saldo_a_favor": 400000, "deuda_bruta": 5600000,
  "deuda_neta": 5200000, "entradas": [ ... ] }
```
`deuda_neta = deuda_bruta − saldo_a_favor` (lo que realmente falta pagar).

### Métodos nuevos (repo `PagoMaterialRepository`)
`crearSaldoAFavor` · `obtenerCreditosDisponibles` · `sumaCreditoDisponible` · `aplicarACredito`
(acepta monto negativo para revertir) · `saldoAFavorPorAbono` · `eliminarSaldoAFavor`.
`insertarAbono` ahora acepta `id_saldo_favor`.

---

## 4. Cómo implementarlo en FLETE y AGUA (pendiente)

Es el **mismo mecanismo**, cambiando el beneficiario a `id_dueno_volqueta`:
- El crédito se crea/consume igual, pero `Saldo_A_Favor.id_dueno_volqueta` (en vez de `id_minero`).
- Con el modelo de flete/agua (cascada por dueño, mes más viejo primero), el sobrepago aparece
  cuando el abono del dueño supera **toda** su deuda (todos los meses). Ese exceso → crédito del dueño.
- Consumir: en el próximo abono del dueño, antes (o además) de la cascada de deuda, se puede
  descontar su crédito disponible.
- Exponerlo en `GET /pagos/flete/deuda` y `/pagos/agua/deuda` como `saldo_a_favor` + `deuda_neta`.

Reutilizar el patrón de `PagoMaterialService`; idealmente extraer un helper compartido
(`consumirCredito`, `crearSaldoAFavor`) parametrizado por beneficiario (minero vs dueño).

---

## 5. Fuera de alcance (por ahora)
- **Devolución** en efectivo (`tipo_resolucion='devolucion'` + ingreso en `Deposito`).
- **Ajuste manual** (`origen='ajuste_manual'`).
- Un abono `saldo_a_favor` que cruce **varios** créditos genera varias filas `Abonos_CxP` (una por
  crédito). Correcto y auditable; si se quiere "un solo pago" se agregaría un `id_pago` agrupador.

---

## 6. Archivos
- `src/services/pagos/pago_material.service.ts` — generar/consumir crédito, guards editar/eliminar.
- `src/repositories/pagos/pago_material.repository.ts` — CRUD de `Saldo_A_Favor` + `id_saldo_favor` en abono.
- `src/repositories/pagos/deuda.repository.ts` + `controllers/pagos/deuda.controller.ts` — `saldo_a_favor`/`deuda_neta`.
- `src/controllers/info/info.controller.ts` (API_MAP) — endpoints documentados.
- (Pendiente flete/agua) `pago_flete.service.ts` / `pago_agua.service.ts`.

### Referencia en `molinos_coments_v4.sql`
- `Saldo_A_Favor` (~1235) · `Abonos_CxP.id_saldo_favor` + CHECK (~1072/1077) · `v_saldos_a_favor_disponibles` (~1374).
- Ver `pago-material-implementado` (memoria) y `ABONOS_material_agrupado_2026-08-31.md`.
