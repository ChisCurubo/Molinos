import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Database from './config/database.config';
import rootRouter from './routes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.config';

dotenv.config();

const app: Application = express();

import { CONFIG } from './config/config';

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

app.listen(PORT, () => {
    console.log(`[Server] Servidor corriendo en http://localhost:${PORT}`);
});

export default app;
