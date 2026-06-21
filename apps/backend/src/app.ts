import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import swaggerUi from 'swagger-ui-express';
import { getCorsOrigins, env, isProduction } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { globalRateLimiter } from './middlewares/rateLimit.js';
import routes from './routes/index.js';

export function createApp(): express.Application {
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: getCorsOrigins(),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction(),
        sameSite: isProduction() ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(globalRateLimiter);

  if (!isProduction()) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  app.use(routes);
  app.use(errorHandler);

  return app;
}
