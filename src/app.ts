import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import Database from './config/database.config';
import { factory } from './config/factory';
import rootRouter from './routes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.config';
import { CONFIG } from './config/config';

const app: Application = express();


// Configuraciones base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));

// Inicialización de la DB
Database.getInstance();

// Documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas Generales de la API
app.use('/api/v1', rootRouter);

const PORT = CONFIG.serverPort;

// Inicializamos los servicios globales (como el caché) a través del factory principal
factory.init().then(() => {
    app.listen(PORT, () => {
        console.log(`[Server] Servidor corriendo en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('[Error] Falló la inicialización del caché:', err);
    process.exit(1);
});

export default app;
