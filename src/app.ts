import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import Database from './config/database.config';
import { factory } from './config/factory';
import rootRouter from './routes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.config';
import { CONFIG, resumenArranque } from './config/config';
import { construirCors } from './config/cors';
import { errorHandler, rutaNoEncontrada } from './middlewares/error.middleware';
import { requestId } from './middlewares/request-id.middleware';
import { estandarizarRespuesta } from './middlewares/estandarizar-respuesta.middleware';

const app: Application = express();
app.set('trust proxy', CONFIG.trustProxy); // tras Caddy (en la VM del front): sin esto el límite de intentos vería siempre la IP del proxy
app.disable('x-powered-by');

// Contrato de errores (ver ESTANDAR_ERRORES.md): primero el id de petición y la red de seguridad del formato,
// para que CUALQUIER respuesta de error posterior (CORS, límites, controladores) salga con el cuerpo estándar.
app.use(requestId);
app.use(estandarizarRespuesta);

// Configuraciones base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(construirCors()));
app.use(cookieParser());
// El requestId va en cada línea del log de accesos: es el hilo para seguir una petición de punta a punta.
morgan.token('id', (req: any) => req.id);
app.use(morgan(CONFIG.isProd ? ':remote-addr :method :url :status :res[content-length] - :response-time ms reqId=:id' : ':method :url :status :response-time ms reqId=:id'));

// Inicialización de la DB
Database.getInstance();

// Documentación Swagger: solo fuera de producción (lista todos los endpoints sin pedir sesión).
// Va ANTES de helmet porque Swagger UI usa scripts en línea que el CSP de helmet bloquearía.
if (!CONFIG.isProd) app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Cabeceras de seguridad (HSTS, nosniff, X-Frame-Options, CSP, etc.) para el resto de la API
app.use(helmet());

// Rutas Generales de la API
app.use('/api/v1', rootRouter);

// Ruta inexistente -> 404 JSON estándar (antes: HTML "Cannot GET"). Va después de TODAS las rutas.
app.use(rutaNoEncontrada);

// Manejador de errores: SIEMPRE al final, después de las rutas (si no, Express lo ignora).
app.use(errorHandler);

const PORT = CONFIG.serverPort;

// Inicializamos los servicios globales (como el caché) a través del factory principal
factory.init().then(() => {
    app.listen(PORT, () => {
        console.log(`[Server] Servidor corriendo en http://localhost:${PORT}`);
        console.log(resumenArranque());
    });
}).catch(err => {
    console.error('[Error] Falló la inicialización del caché:', err);
    process.exit(1);
});

export default app;
