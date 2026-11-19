import { Router } from 'express';
import multer from 'multer';
import { factory } from '../../config/factory';
import { MAX_BYTES } from '../../services/archivos/archivo.service';
import { limitarSubidas } from '../../helpers/upload.middleware';
import { requireRole } from '../../helpers/auth.middleware';
import { fail } from '../../errors/responder';

const router = Router();
const ctrl = factory.archivos.getArchivoController();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

/**
 * @swagger
 * /archivos:
 *   post:
 *     summary: Sube un comprobante (PDF, PNG, JPG o WebP, máx 15 MB; ?carpeta=comprobantes|soportes|fotos). Devuelve key y url
 *     tags: [Archivos]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               archivo: { type: string, format: binary }
 *     responses:
 *       201: { description: "{ url, key, tipo, tamano }" }
 */
router.post('/', limitarSubidas, (req, res, next) =>
    upload.single('archivo')(req, res, (err: any) => err
        ? fail(res, err)
        : next()), ctrl.subir);

/** GET /archivos/comprobantes/2026/11/<uuid>.pdf — requiere sesión; MinIO no se expone al exterior. */
router.get('/*key', ctrl.ver);

/** DELETE /archivos/<key> — solo administrador (rol 1). */
router.delete('/*key', requireRole([1]), ctrl.eliminar);

export default router;
