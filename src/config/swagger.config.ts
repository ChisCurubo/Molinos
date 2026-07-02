import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Molinos ERP v4 API',
      version: '1.0.0',
      description: 'Documentación de la API de Molinos ERP v4',
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Servidor Local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/**/*.ts'], // Busca anotaciones en los archivos de rutas
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
