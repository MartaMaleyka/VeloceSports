import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env, getCorsOrigins, isProduction, parseTrustProxy } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { globalRateLimiter } from './middlewares/rateLimit.js';
import { correlationIdMiddleware } from './middleware/correlation-id.middleware.js';
import { requestLoggingMiddleware } from './middleware/request-logging.middleware.js';
import routes from './routes/index.js';

export function createApp(): express.Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));

  app.use(helmet());
  app.use(
    cors({
      origin: getCorsOrigins(),
      credentials: true,
    }),
  );
  app.use(correlationIdMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(globalRateLimiter);

  if (!isProduction()) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  app.use(routes);
  app.use(errorHandler);

  return app;
}
