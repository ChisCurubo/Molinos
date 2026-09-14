# Estado de módulos — síntesis (qué está hecho y qué falta)

> Documento único que **reemplaza** a los antiguos `.md` de diseño/planeación de la raíz
> (ABONOS_*, Agua_pendiente, SIgpasos*, SIGUIENTES_PASOS_procesamiento, MAPA-ENDPOINTS*).
> Se conservan aparte: `SALDO_A_FAVOR_2026-09-01.md` (detalle del crédito por sobrepago) y
> `SESION_2026-09-05_cierre.md` (bitácora de la última sesión). Rama `feat/con-front-Vicky`.
> Última actualización: 2026-09-05.
>
> ✅ = implementado · ⏳ = pendiente. Los mapas de endpoints se regeneran con
> `node scripts/build-endpoints-md.js` (salen de `/info` API_MAP); los reportes de prueba, corriendo
> los tests en `tests/` (`node tests/<archivo>.test.mjs`).

---

## 1. Modelo común de pagos (aplica a material, flete y agua)

Todo lo que la empresa debe pagar vive en **`Cuentas_Por_Pagar` (CxP)**. No se paga "la entrada": se
crea una CxP y sobre ella se registran **abonos** (`Abonos_CxP`), total o parcial, hasta cubrir el saldo.

```
Dominio (entrada material / flete / agua)
   └─ Cuentas_Por_Pagar_Relacion ─► Cuentas_Por_Pagar (valor_total, valor_pagado, saldo, estado)
                                        ▲── Abonos_CxP (1..N: valor, fecha, metodo, comprobante)
```

- El `estado` (pendiente/parcial/pagado) y `saldo` **no se escriben a mano**: salen de `valor_pagado`
  vs `valor_total`, recalculados **en el service** (el trigger `trg_after_abono_cxp` sigue Pendiente en BD).
- **Prorrateo:** cada ítem de una CxP está pagado al mismo % que la cuenta:
  `pagado_item = monto_aplicado × (valor_pagado / valor_total)`. Las vistas de estado deben usar esto
  (no `SUM(abonos)` por ítem, que cuenta de más con el agrupamiento).
- **Enlace por flujo:** material→`id_entrada` subtipo`'material'` · flete→`id_entrada` subtipo`'flete'`
  · agua→`id_agua`. Una entrada genera hasta DOS CxP (material al minero + flete al volquetero).

Tablas ref en `molinos_coments_v4.sql`: `Cuentas_Por_Pagar` (~1046), `Abonos_CxP` (~1080),
`Cuentas_Por_Pagar_Relacion` (~1101), `Saldo_A_Favor` (~1251).

---

## 2. Pago de MATERIAL — ✅ IMPLEMENTADO (2026-08-31)

Módulo `/pagos/material`. Se agrupan **varias volquetas del mismo minero** en una CxP y se abona a lo
largo del tiempo. Valor por volqueta = `material_planta_entrada.precio_total` (material SIN gastos).
Prorrateo por volqueta. Todo transaccional en `PagoMaterialService`.

- `POST /pagos/material` (entradas[], concepto?, fecha_limite?; minero derivado; valida mismo minero y
  no-duplicado) · `GET /pagos/material` (tablero ?id_minero&estado) · `GET /pagos/material/:id` (detalle
  prorrateado) · `PATCH /pagos/material/:id` (agregar/quitar volquetas) · `DELETE /pagos/material/:id`
  (anula; 409 si tiene abonos).
- `POST /pagos/material/:id/abonos` · `PATCH|DELETE /pagos/material/abonos/:idAbono`.
- **Saldo a favor** (sobrepago) soportado — ver `SALDO_A_FAVOR_2026-09-01.md`.
- Vista `v_estado_pago_material` ya PRORRATEADA. Estado real = CxP + vista; **no** usar
  `material_planta_entrada.estado='pagada'` (campo manual desincronizado).

---

## 3. Pago de FLETE — ✅ IMPLEMENTADO (2026-09-05, probado 27/27)

Módulo `/pagos/flete`. CxP por **(dueño, mes)** categoría 'Flete volqueta'; abono en **cascada** del mes
más viejo al más nuevo. Valor por viaje = flete **NETO** = `costo_volqueta − ACPM` (con arrastre del ACPM
sobrante entre viajes del dueño, vía `CombustibleService.calcularNetoFletePorDueno`). Detalle completo en
`SESION_2026-09-05_cierre.md` y memoria `pago-flete-implementado`.

- `GET /pagos/flete/deuda` (dashboard por dueño: saldo + los 2 "positivos de gasolina") ·
  `GET /pagos/flete/dueno/:id?mes&anio` (materializa cuentas mensuales → meses/viajes/abonos/resumen) ·
  `POST /pagos/flete/dueno/:id/abonos` (cascada) · `PATCH|DELETE /pagos/flete/abonos/:idAbono`.
- **Trazabilidad:** cada viaje muestra `flete_bruto · acpm · flete_neto`.
- **Estado por viaje (§ efecto flete):** al abonar se actualiza `material_planta_entrada.estado_pago_flete`
  y `Volqueta_Vehiculo.estado_pago`. Viaje con ACPM ≥ flete → 'pagado' (saldado por gasolina), sin deuda.
- **2 positivos de gasolina:** `credito_gasolina` (ACPM adelantado de más) + `credito_sobrepago`
  (Saldo_A_Favor por abonar de más).
- SQL: `migracion_pagos_flete_2026-09-05.sql` (vista `v_estado_pago_flete` NETA+PRORRATEADA), ya aplicada.

---

## 4. Pago de AGUA — ✅ IMPLEMENTADO (2026-09-05, probado 23/23)

Módulo `/pagos/agua`. Mismo motor que flete: CxP por **(dueño, mes)** categoría 'Agua', abono en cascada.
Ítem = un registro de `agua_planta` (enlace `id_agua`). Neto **per-registro** = `max(0, valor_total(bruto)
− Σ Combustible(id_agua))` — el ACPM se **cruza desde Combustible**, no desde `agua_planta.acpm` (legada).
Sin arrastre entre registros (opción A); el excedente de ACPM de un registro es "positivo de gasolina".

- `GET /pagos/agua/deuda` (dashboard por dueño: saldo + credito_gasolina + credito_sobrepago) ·
  `GET /pagos/agua/dueno/:id?mes&anio` (materializa cuentas mensuales → meses/registros/abonos/resumen) ·
  `POST /pagos/agua/dueno/:id/abonos` (cascada) · `PATCH|DELETE /pagos/agua/abonos/:idAbono`.
- **Estado por registro:** `agua_planta.estado_pago` (nueva col, ALTER 2026-09-05) = estado de su CxP.
  Registro con ACPM ≥ bruto → 'pagado' (saldado por gasolina), sin deuda.
- **Trazabilidad:** cada registro muestra `bruto · acpm · neto`.
- **`agua.service.reporteMensual`** ahora saca `abonado` de `Abonos_CxP` (antes 0) y ajusta `saldo_inicio`
  por abonos previos. Los reads de agua (`listar`, `resumen`, `saldos`, `valor_neto`) pisan el neto por
  registro en 0 (consistente con la opción A).
- SQL: `migracion_pagos_agua_2026-09-05.sql` (ALTER estado + vista `v_estado_agua` NETA+PRORRATEADA), aplicada.

---

## 5. ACPM / Combustible — ✅ IMPLEMENTADO (2026-09-02, probado 19/19)

El ACPM (adelanto de combustible al transportador) vive en la tabla **`Combustible`** (fuente única) y se
descuenta del flete/agua. Regla: en Combustible solo va el id de origen (`id_material_planta_entrada` para
flete | `id_agua` para agua) + `id_dueno_volqueta` + `valor`; lo demás por JOIN. Detalle en memoria
`acpm-flete-combustible`. Migración `migracion_combustible_acpm_2026-09-02.sql` (aplicada).

- `GET /pagos/combustible` · `GET /pagos/combustible/:id` · `GET /pagos/combustible/dueno/:id/neto-flete`
  (cascada de arrastre por dueño). Enganchado en material (`/material/entrada` acepta `acpm`,`id_gasolinera`)
  y agua (`/material/agua`), con sincronización en create/update/delete.
- **✅ Decidido (2026-09-05):** `Combustible.id_gasolinera` queda **NULL-able / opcional** — el ACPM se
  registra sin gasolinera y se completa al conciliar el pago a la estación. Sin migración pendiente.

---

## 6. Saldo a favor (crédito por sobrepago) — ✅ material · ⏳ flete/agua

Cuando se paga de más, el exceso queda como crédito **del tercero** (`Saldo_A_Favor`, beneficiario por
minero/dueño). Reutilizable en cuentas futuras o devolución. Implementado en material; en **flete** ya se
genera el crédito del dueño al sobrepagar (falta consumirlo explícitamente en el próximo abono). Detalle y
reglas de editar/eliminar: **`SALDO_A_FAVOR_2026-09-01.md`** (se conserva).

Fuera de alcance: devolución en efectivo (`tipo_resolucion='devolucion'` + Deposito), `ajuste_manual`.

---

## 7. Procesamiento de material / migración de triggers

- **Fases 1–3 ✅** (2026-08-22): triggers de inventario/kardex, maquila y precios migrados a la app.
  Triggers #1/#2/#3 (concentrado) **ya borrados** en BD. Inventario `/material/inventario/*` reescrito
  sobre tablas base. Detalle en memorias `cierre-lote-doble-escritura`, `inventario-y-analisis-lote-rotos`.
- **Fase 4 (viajes) — migrada en código** (memoria `viajes-migracion-fase4`). **✅ DROP completo: 2026-09-05
  la BD `molinos_erp_v4` tiene 0 triggers** (verificado en `information_schema.TRIGGERS`). Toda la lógica
  vive en la app.
- ⚠️ Los métodos espejo de `TriggerLogicRepository` están desfasados: no confiar en ellos (ya no hay
  triggers que reflejar).

---

## 8. Pendientes transversales

- ~~DROP de triggers de viajes~~ ✅ hecho (0 triggers en BD, 2026-09-05).
- ~~Decisión `Combustible.id_gasolinera`~~ ✅ decidido: opcional (NULL-able).
- ~~Pase de AGUA~~ ✅ implementado (§4). **Sistema de pagos material/flete/agua COMPLETO.**
- **Nada commiteado**: todo el trabajo reciente está en el working tree.
- **`npm run build`** roto por `test_deuda.ts` (fuera de `rootDir`); `npm run dev` (ts-node) recarga solo.
  Compilación limpia con `npx tsc --noEmit` salvo ese archivo conocido.
- Regenerar mapas/Postman al cambiar endpoints: `scripts/build-endpoints-md.js` / `scripts/build-postman.js`.

## 9. Anticipos a terceros — ✅ FASE 1 implementada (2026-09-13, standalone) · ⏳ FASE 2 (incorporarlo al consumo)

Módulo `/pagos/anticipos` (crear/listar/detalle/anular). Decisiones cerradas en `ANTICIPOS_plan.md` §4.

- Al crear (`POST /pagos/anticipos { tercero: 'minero'|'dueno_volqueta'|'proveedor', id, monto,
  comprobante_url, fecha?, metodo_pago?, descripcion? }`) se genera, en una sola transacción: fila en
  `Anticipos_Terceros` (registro de negocio) + `Cuentas_Por_Pagar` categoría 'Anticipo' **pagada de
  inmediato** con su `Abonos_CxP` real (el egreso) + un **espejo en `Saldo_A_Favor`** (`origen='anticipo'`,
  nueva col `id_anticipo`) — ese espejo es el crédito que de verdad se va a consumir después.
- `GET /pagos/anticipos?tercero=&id=&estado=` (listar) · `GET /pagos/anticipos/:id` (detalle + historial de
  `Historial_Descuentos_Anticipos`) · `DELETE /pagos/anticipos/:id` (anula todo: CxP+abono+saldo a
  favor+anticipo — solo si `monto_usado = 0`, nada se ha consumido aún).
- Requiere aplicar **`migracion_anticipos_terceros_2026-09-13.sql`** (agrega `'anticipo'` a
  `Saldo_A_Favor.origen` + `id_anticipo`; `'anulado'` a `Anticipos_Terceros.estado`; generaliza
  `Historial_Descuentos_Anticipos` con `id_entrada` NULLable + `id_abono_cxp`) — **aún no aplicada en BD**.
- Archivos: `ports/pagos/{repository_port,service_port}/anticipo.*`, `repositories/pagos/anticipo.repository.ts`,
  `services/pagos/anticipo.service.ts`, `controllers/pagos/anticipo.controller.ts`,
  `routes/pagos/anticipo.routes.ts`, wireado en `pagos.factory.ts` y `routes.pagos.ts`.
- **Compila limpio** (`npx tsc --noEmit`, salvo el `test_deuda.ts` conocido). **Sin probar contra BD real**
  todavía (falta aplicar la migración) ni con tests de endpoints.

⏳ **Pendiente — Fase 2 (incorporación al sistema):** extender la cascada de abonos de
`pago_material`/`pago_flete`/`pago_agua` para que, al abonar, se pueda consumir el crédito del tercero
(`Saldo_A_Favor`, origen `pago_excedido` **o** `anticipo`) como parte del pago — hoy el módulo de anticipos
es standalone: crea y anula el crédito, pero nada lo descuenta todavía. Esto cierra también el pendiente
"consumir saldo a favor en flete/agua" (§6), ya que sería el mismo mecanismo genérico.

## 10. Pendiente transversal adicional
- **Registrar `/pagos/{flete,agua,combustible,anticipos}/*` en `info.controller` (API_MAP) + Postman.**
