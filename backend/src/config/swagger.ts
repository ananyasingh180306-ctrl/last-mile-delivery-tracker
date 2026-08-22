import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Last-Mile Delivery Tracker API Documentation',
      version: '1.0.0',
      description: 'REST API documentation for Last-Mile Delivery Tracker backend. Provides routes for user authentication, admin crud operations, rate calculations, order lifecycles, and auto-assignment.'
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js']
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
