import { Pool } from 'mysql2/promise';
import { IPagoMaterialRepository } from '../../ports/pagos/repository_port/pago_material.repository.interface';
import { IPagoMaterialService } from '../../ports/pagos/service_port/pago_material.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pago AGRUPADO de material: se agrupan varias volquetas de UN minero en una sola
 * Cuenta_Por_Pagar y se abona a lo largo del tiempo. El valor de cada volqueta es su
 * `precio_total` (precio del material, SIN gastos). Todo transaccional.
 */
export class PagoMaterialService implements IPagoMaterialService {
    constructor(private repo: IPagoMaterialRepository, private db: Pool) {}

    // ── Crear la cuenta de grupo desde varias entradas ──────────────────────
    async crearCuentaTx(data: any): Promise<any> {
        const entradas: number[] = Array.isArray(data.entradas)
            ? [...new Set(data.entradas.map((n: any) => Number(n)))] as number[]
            : [];
        if (entradas.length === 0) throw err('Debe indicar al menos una entrada (volqueta) a pagar');

        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const filas = await this.repo.obtenerEntradasParaPago(entradas, conn);
            if (filas.length !== entradas.length) {
                const encontradas = new Set(filas.map(f => Number(f.id)));
                const faltan = entradas.filter(id => !encontradas.has(id));
                throw err(`Entradas inexistentes: ${faltan.join(', ')}`, 404);
            }

            // Todas del mismo minero (una CxP = un solo beneficiario).
            const mineros = [...new Set(filas.map(f => f.id_minero))];
            if (mineros.length > 1 || mineros[0] == null) {
                throw err('Todas las volquetas deben ser del mismo minero para agruparlas en un pago');
            }
            const idMinero = Number(mineros[0]);

            // Todas deben tener precio de material calculado (precio_total > 0).
            const sinPrecio = filas.filter(f => !(Number(f.precio_total) > 0)).map(f => Number(f.id));
            if (sinPrecio.length) {
                throw err(`Estas entradas no tienen precio de material (precio_total = 0): ${sinPrecio.join(', ')}. ` +
                          `Aplique análisis/precio antes de agruparlas para pago.`, 400);
            }

            // Ninguna ya incluida en otra CxP de material.
            const yaEn = await this.repo.entradasYaEnCuenta(entradas, undefined, conn);
            if (yaEn.length) throw err(`Estas entradas ya están en una cuenta de pago: ${yaEn.join(', ')}`, 409);

            const valorTotal = r2(filas.reduce((s, f) => s + (Number(f.precio_total) || 0), 0));
            if (valorTotal <= 0) throw err('El valor total del material a pagar es 0; revise los precios de las entradas');

            const idCategoria = await this.repo.resolverCategoriaMaterial(conn);
            const concepto = (data.concepto && String(data.concepto).trim())
                || `Material ${filas[0].minero ?? ''} - ${filas.length} volqueta(s)`.trim();

            const idCxp = await this.repo.crearCuenta(
                { id_categoria: idCategoria, concepto, id_minero: idMinero, valor_total: valorTotal, fecha_limite: data.fecha_limite },
                conn
            );

            for (const f of filas) {
                await this.repo.crearRelacion(idCxp, Number(f.id), r2(Number(f.precio_total) || 0),
                    `Volqueta ${f.numero_volqueta}`, conn);
            }

            // Opción: descontar de una vez el saldo a favor disponible del minero.
            if (data.aplicar_saldo_a_favor) {
                await this.consumirCredito(idCxp, idMinero, Number.MAX_SAFE_INTEGER,
                    new Date().toISOString().slice(0, 10), 'Descuento de saldo a favor al crear', conn);
            }

            await conn.commit();
            return await this.obtenerDetalle(idCxp);
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    // ── Editar la cuenta: agregar/quitar volquetas, concepto, fecha_limite ───
    async actualizarCuentaTx(idCxp: number, data: any): Promise<any> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            if (!cuenta) throw err('Cuenta no encontrada', 404);
            if (cuenta.estado === 'anulado') throw err('La cuenta está anulada', 409);

            const agregar: number[] = Array.isArray(data.agregar_entradas)
                ? [...new Set(data.agregar_entradas.map((n: any) => Number(n)))] as number[] : [];
            const quitar: number[] = Array.isArray(data.quitar_entradas)
                ? [...new Set(data.quitar_entradas.map((n: any) => Number(n)))] as number[] : [];

            const actuales = new Set(await this.repo.idsEntradasDeCuenta(idCxp, conn));

            // Quitar
            for (const id of quitar) {
                if (!actuales.has(id)) throw err(`La entrada ${id} no pertenece a esta cuenta`, 400);
                await this.repo.eliminarRelacion(idCxp, id, conn);
                actuales.delete(id);
            }

            // Agregar (mismo minero, no duplicada en otra CxP, no repetida en esta)
            if (agregar.length) {
                const filas = await this.repo.obtenerEntradasParaPago(agregar, conn);
                if (filas.length !== agregar.length) {
                    const enc = new Set(filas.map(f => Number(f.id)));
                    throw err(`Entradas inexistentes: ${agregar.filter(id => !enc.has(id)).join(', ')}`, 404);
                }
                for (const f of filas) {
                    if (Number(f.id_minero) !== Number(cuenta.id_minero)) {
                        throw err(`La entrada ${f.id} es de otro minero; no se puede agregar a esta cuenta`, 400);
                    }
                    if (actuales.has(Number(f.id))) throw err(`La entrada ${f.id} ya está en esta cuenta`, 400);
                    if (!(Number(f.precio_total) > 0)) {
                        throw err(`La entrada ${f.id} no tiene precio de material (precio_total = 0); no se puede agregar`, 400);
                    }
                }
                const yaEn = await this.repo.entradasYaEnCuenta(agregar, idCxp, conn);
                if (yaEn.length) throw err(`Estas entradas ya están en otra cuenta de pago: ${yaEn.join(', ')}`, 409);

                for (const f of filas) {
                    await this.repo.crearRelacion(idCxp, Number(f.id), r2(Number(f.precio_total) || 0),
                        `Volqueta ${f.numero_volqueta}`, conn);
                    actuales.add(Number(f.id));
                }
            }

            if (actuales.size === 0) {
                throw err('La cuenta no puede quedar sin volquetas; use eliminar para anularla', 400);
            }

            // Recalcular valor_total desde las relaciones; no puede quedar por debajo de lo ya pagado.
            const nuevoTotal = r2(await this.repo.sumaMontoRelaciones(idCxp, conn));
            if (nuevoTotal < Number(cuenta.valor_pagado)) {
                throw err(`El nuevo total (${nuevoTotal}) es menor que lo ya abonado (${cuenta.valor_pagado}); ` +
                          `elimine abonos antes de quitar esas volquetas`, 409);
            }
            await this.repo.actualizarValorTotal(idCxp, nuevoTotal, conn);
            await this.repo.actualizarCabeceraCuenta(idCxp,
                { concepto: data.concepto, fecha_limite: data.fecha_limite }, conn);
            await this.repo.recalcularCuenta(idCxp, conn);

            await conn.commit();
            return await this.obtenerDetalle(idCxp);
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    // ── Anular la cuenta (borrado lógico). Solo si no tiene abonos. ──────────
    async anularCuentaTx(idCxp: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            if (!cuenta) throw err('Cuenta no encontrada', 404);
            if (cuenta.estado === 'anulado') throw err('La cuenta ya está anulada', 409);
            if (Number(cuenta.valor_pagado) > 0) {
                throw err('La cuenta tiene abonos registrados; elimínelos antes de anularla', 409);
            }
            await this.repo.anularCuenta(idCxp, conn);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    // ── Registrar un abono (transferencia) ──────────────────────────────────
    // Si el valor supera el saldo de la cuenta, la porción que sobra se registra como
    // SALDO A FAVOR del minero (crédito reutilizable en otras cuentas suyas).
    async registrarAbonoTx(idCxp: number, data: any): Promise<any> {
        // Pagar con crédito existente es otra operación.
        if (data.metodo_pago === 'saldo_a_favor') return this.abonarConCreditoTx(idCxp, data);

        const valor = r2(Number(data.valor));
        if (!(valor > 0)) throw err('El valor del abono debe ser mayor a 0');
        const comprobante = (data.comprobante_url ?? '').toString().trim();
        if (!comprobante) throw err('Cada abono requiere el comprobante (comprobante_url)');

        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            if (!cuenta) throw err('Cuenta no encontrada', 404);
            if (cuenta.estado === 'anulado') throw err('La cuenta está anulada', 409);
            if (cuenta.estado === 'pagado') throw err('La cuenta ya está pagada', 409);

            const saldo = r2(Number(cuenta.valor_total) - Number(cuenta.valor_pagado));
            const aplicado = r2(Math.min(valor, saldo));      // lo que cubre esta cuenta
            const excedente = r2(valor - aplicado);           // lo que sobra → saldo a favor

            const idAbono = await this.repo.insertarAbono({
                id_cuenta_pagar: idCxp,
                fecha_abono: data.fecha_abono || new Date().toISOString().slice(0, 10),
                valor: aplicado,
                metodo_pago: data.metodo_pago || 'transferencia',
                comprobante_url: comprobante,
                observaciones: data.observaciones
            }, conn);

            let idSaldoFavor: number | null = null;
            if (excedente > 0) {
                idSaldoFavor = await this.repo.crearSaldoAFavor({
                    id_abono_cxp_orig: idAbono,
                    id_minero: cuenta.id_minero,
                    id_cuenta_pagar: idCxp,
                    monto_original: excedente,
                    descripcion: `Sobrepago del abono #${idAbono} a la cuenta #${idCxp}`
                }, conn);
            }

            await this.repo.recalcularCuenta(idCxp, conn);

            await conn.commit();
            const [abono, detalle] = await Promise.all([this.repo.obtenerAbono(idAbono), this.obtenerDetalle(idCxp)]);
            return {
                abono, cuenta: detalle.cuenta,
                saldo_a_favor_generado: excedente,
                id_saldo_favor: idSaldoFavor
            };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    // ── Pagar una cuenta consumiendo el SALDO A FAVOR del minero ─────────────
    // metodo_pago='saldo_a_favor'. Si mandas `valor` es el tope a aplicar; si no, aplica
    // lo máximo posible (min entre saldo de la cuenta y crédito disponible).
    async abonarConCreditoTx(idCxp: number, data: any): Promise<any> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            if (!cuenta) throw err('Cuenta no encontrada', 404);
            if (cuenta.estado === 'anulado') throw err('La cuenta está anulada', 409);
            if (cuenta.estado === 'pagado') throw err('La cuenta ya está pagada', 409);

            const disponible = await this.repo.sumaCreditoDisponible(cuenta.id_minero, conn);
            if (disponible <= 0) throw err('El minero no tiene saldo a favor disponible', 409);

            const tope = data.valor !== undefined ? r2(Number(data.valor)) : Number.MAX_SAFE_INTEGER;
            if (data.valor !== undefined && !(tope > 0)) throw err('El valor a descontar debe ser mayor a 0');

            const aplicado = await this.consumirCredito(
                idCxp, cuenta.id_minero, tope,
                data.fecha_abono || new Date().toISOString().slice(0, 10),
                data.observaciones, conn
            );
            if (aplicado <= 0) throw err('No se aplicó crédito (sin saldo pendiente o sin crédito disponible)', 409);

            await conn.commit();
            const detalle = await this.obtenerDetalle(idCxp);
            return { aplicado_saldo_a_favor: aplicado, cuenta: detalle.cuenta };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    // Consume crédito del minero contra una cuenta (más viejo primero), hasta `maxMonto`
    // y hasta el saldo de la cuenta. Inserta abonos metodo='saldo_a_favor' (sin comprobante)
    // y baja cada Saldo_A_Favor. Devuelve el total aplicado.
    private async consumirCredito(idCxp: number, idMinero: number, maxMonto: number,
                                  fecha: string, obs: any, conn: any): Promise<number> {
        const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
        const saldo = r2(Number(cuenta.valor_total) - Number(cuenta.valor_pagado));
        const objetivo = r2(Math.min(maxMonto, saldo));
        if (objetivo <= 0) return 0;

        const creditos = await this.repo.obtenerCreditosDisponibles(idMinero, conn);
        let restante = objetivo, total = 0;
        for (const c of creditos) {
            if (restante <= 0) break;
            const take = r2(Math.min(restante, Number(c.saldo_disponible)));
            if (take <= 0) continue;
            await this.repo.insertarAbono({
                id_cuenta_pagar: idCxp, fecha_abono: fecha, valor: take,
                metodo_pago: 'saldo_a_favor', id_saldo_favor: c.id,
                comprobante_url: null, observaciones: obs ?? 'Descuento de saldo a favor'
            }, conn);
            await this.repo.aplicarACredito(c.id, take, conn);
            restante = r2(restante - take);
            total = r2(total + take);
        }
        if (total > 0) await this.repo.recalcularCuenta(idCxp, conn);
        return total;
    }

    // ── Editar un abono ─────────────────────────────────────────────────────
    async actualizarAbonoTx(idAbono: number, data: any): Promise<any> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (abono.metodo_pago === 'saldo_a_favor') {
                throw err('Un descuento de saldo a favor no se edita; elimínalo (se devuelve el crédito) y vuelve a aplicarlo', 409);
            }
            const safGen = await this.repo.saldoAFavorPorAbono(idAbono, conn);
            if (safGen) {
                throw err('Este abono generó un saldo a favor; elimínalo y regístralo de nuevo con el valor correcto', 409);
            }
            const idCxp = Number(abono.id_cuenta_pagar);
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            if (!cuenta || cuenta.estado === 'anulado') throw err('La cuenta está anulada o no existe', 409);

            const campos: any = {};
            if (data.fecha_abono !== undefined)     campos.fecha_abono = data.fecha_abono;
            if (data.metodo_pago !== undefined) {
                if (data.metodo_pago === 'saldo_a_favor') throw err('El método saldo_a_favor aún no está soportado');
                campos.metodo_pago = data.metodo_pago;
            }
            if (data.comprobante_url !== undefined) {
                const comp = (data.comprobante_url ?? '').toString().trim();
                if (!comp) throw err('El comprobante (comprobante_url) no puede quedar vacío');
                campos.comprobante_url = comp;
            }
            if (data.observaciones !== undefined)    campos.observaciones = data.observaciones;

            if (data.valor !== undefined) {
                const nuevo = r2(Number(data.valor));
                if (!(nuevo > 0)) throw err('El valor del abono debe ser mayor a 0');
                const otros = await this.repo.sumaOtrosAbonos(idCxp, idAbono, conn);
                if (nuevo + otros > Number(cuenta.valor_total) + 1e-6) {
                    throw err(`El abono deja el total pagado (${r2(nuevo + otros)}) por encima del valor de la cuenta ` +
                              `(${cuenta.valor_total})`, 409);
                }
                campos.valor = nuevo;
            }

            await this.repo.actualizarAbono(idAbono, campos, conn);
            await this.repo.recalcularCuenta(idCxp, conn);

            await conn.commit();
            const [ab, detalle] = await Promise.all([this.repo.obtenerAbono(idAbono), this.obtenerDetalle(idCxp)]);
            return { abono: ab, cuenta: detalle.cuenta };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    // ── Eliminar un abono ───────────────────────────────────────────────────
    async eliminarAbonoTx(idAbono: number): Promise<any> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            const idCxp = Number(abono.id_cuenta_pagar);

            // Si el abono consumió crédito (saldo_a_favor), se lo devolvemos al minero.
            if (abono.metodo_pago === 'saldo_a_favor' && abono.id_saldo_favor) {
                await this.repo.aplicarACredito(Number(abono.id_saldo_favor), -r2(Number(abono.valor)), conn);
            }
            // Si el abono GENERÓ un saldo a favor (sobrepago), lo revertimos: solo si no se ha usado.
            const safGen = await this.repo.saldoAFavorPorAbono(idAbono, conn);
            if (safGen) {
                if (Number(safGen.monto_aplicado) > 0) {
                    throw err('El sobrepago de este abono ya se usó en otra cuenta; no se puede eliminar. ' +
                              'Revierte primero ese descuento.', 409);
                }
                await this.repo.eliminarSaldoAFavor(Number(safGen.id), conn);
            }

            await this.repo.eliminarAbono(idAbono, conn);
            await this.repo.recalcularCuenta(idCxp, conn);

            await conn.commit();
            return (await this.obtenerDetalle(idCxp)).cuenta;
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    // ── Lectura ─────────────────────────────────────────────────────────────
    async obtenerDetalle(idCxp: number): Promise<any> {
        const cuenta = await this.repo.obtenerCuenta(idCxp);
        if (!cuenta) throw err('Cuenta no encontrada', 404);
        const [volquetas, abonos] = await Promise.all([
            this.repo.obtenerRelacionesConProrrateo(idCxp),
            this.repo.listarAbonos(idCxp)
        ]);
        // Anida el/los análisis de cada entrada dentro de su volqueta.
        const idsEntrada = volquetas.map(v => Number(v.id_entrada));
        const analisis = await this.repo.obtenerAnalisisDeEntradas(idsEntrada);
        const porEntrada = new Map<number, any[]>();
        for (const a of analisis) {
            const k = Number(a.id_entrada);
            if (!porEntrada.has(k)) porEntrada.set(k, []);
            porEntrada.get(k)!.push(a);
        }
        for (const v of volquetas) v.analisis = porEntrada.get(Number(v.id_entrada)) || [];
        return {
            cuenta: {
                id: cuenta.id,
                concepto: cuenta.concepto,
                id_minero: cuenta.id_minero,
                minero: cuenta.minero,
                valor_total: cuenta.valor_total,
                valor_pagado: cuenta.valor_pagado,
                saldo: cuenta.saldo,
                estado: cuenta.estado,
                fecha_creacion: cuenta.fecha_creacion,
                fecha_limite: cuenta.fecha_limite,
                num_abonos: abonos.length
            },
            volquetas,
            abonos
        };
    }

    async listarCuentas(filtros: any): Promise<any[]> {
        return await this.repo.listarCuentasMaterial(filtros);
    }

    // Todos los abonos de material (todas las cuentas), paginado de a 50 por defecto.
    async listarAbonosPaginado(filtros: { id_minero?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<any> {
        const page = Math.max(1, Number(filtros.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(filtros.limit) || 50));
        const { rows, total } = await this.repo.listarAbonosPaginado({ ...filtros, page, limit });
        return { abonos: rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 } };
    }
}
