import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VeloceSports API',
      version: '1.0.0',
      description: 'API documentation for VeloceSports - Sports Academy Management Platform',
      contact: {
        name: 'VeloceSports Team',
        email: 'support@velocesports.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.velocesports.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Request validation failed' },
                details: { type: 'object' },
                requestId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
        Player: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            jerseyNumber: { type: 'number', minimum: 1, maximum: 99 },
            dateOfBirth: { type: 'string', format: 'date' },
            position: { type: 'string' },
            email: { type: 'string', format: 'email' },
            parentEmail: { type: 'string', format: 'email' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Match: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            opponent: { type: 'string' },
            matchDate: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'] },
            periodsCount: { type: 'number' },
            periodDurationMinutes: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        GameAction: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            matchId: { type: 'number' },
            playerId: { type: 'number' },
            actionCode: { type: 'number' },
            minute: { type: 'number' },
            period: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Observation: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            playerId: { type: 'number' },
            text: { type: 'string' },
            category: { type: 'string' },
            rating: { type: 'number', minimum: 1, maximum: 5 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    path.join(__dirname, '../routes/*.routes.ts'),
    path.join(__dirname, '../controllers/*.controller.ts'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
