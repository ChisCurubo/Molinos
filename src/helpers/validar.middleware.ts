import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { fail } from '../errors/responder';
import { AppError } from '../errors/app-error';

/**
 * Validación de los campos de DINERO y FECHA en endpoints de pagos. Solo revisa lo que viene: los campos
 * que no están en el esquema pasan tal cual (looseObject), y no reescribe el body (no cambia el comportamiento
 * de los servicios; solo corta los datos absurdos: negativos, NaN, Infinity, textos, fechas rotas).
 * shortcut: valida forma y rango, no reglas de negocio (saldo, sobrepago): eso sigue en cada servicio.
 */
const dinero = z.coerce.number().positive('debe ser mayor a 0').max(1e13, 'valor demasiado grande').nullish();
const id     = z.coerce.number().int().positive().nullish();
const fecha  = z.string().regex(/^\d{4}-\d{2}-\d{2}([T ].*)?$/, 'fecha inválida (AAAA-MM-DD)').nullish();
const texto  = (n: number) => z.string().max(n).nullish();

const campos = {
    valor: dinero, monto: dinero, valor_total: dinero, monto_total: dinero,
    fecha, fecha_abono: fecha, fecha_cobro: fecha, fecha_limite: fecha,
    id_cuenta_bancaria: id, id_categoria: id, id_proveedor: id, id_empleado: id,
    metodo_pago: texto(40), observaciones: texto(2000), concepto: texto(255), descripcion: texto(2000),
};
const esquema = z.looseObject({
    ...campos,
    abono: z.looseObject({ valor: dinero, fecha_cobro: fecha, metodo_pago: texto(40) }).nullish(),
});

export const validarDinero = (req: Request, res: Response, next: NextFunction): void => {
    const r = esquema.safeParse(req.body ?? {});
    if (r.success) { next(); return; }
    fail(res, AppError.validacion('Datos inválidos', r.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))));
};
