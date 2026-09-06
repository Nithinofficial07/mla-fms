import path from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestContext } from './middleware/requestContext.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/error.js';
import { api } from './routes/index.js';
import { openapiSpec } from './docs/openapi.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(requestContext);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // The SPA (MUI/emotion) needs inline styles; document previews use blob:/data:.
      contentSecurityPolicy: env.SERVE_CLIENT
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              frameSrc: ["'self'", 'blob:'],
              objectSrc: ["'self'", 'blob:'],
              workerSrc: ["'self'", 'blob:'],
              // Only force HTTPS upgrades when actually served over TLS -
              // otherwise a plain-HTTP LAN deployment can't load its own assets.
              upgradeInsecureRequests: env.BACKEND_URL.startsWith('https') ? [] : null,
            },
          }
        : false,
    }),
  );

  app.use(
    cors({
      origin: env.FRONTEND_URL.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(
    pinoHttp({
      logger,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      genReqId: (req: any) => req.id ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      autoLogging: { ignore: (req: any) => req.url === '/api/health' },
    }),
  );

  // Health check before the rate limiter so platform probes (Render, k8s,
  // uptime monitors) never consume the request budget.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec as Record<string, unknown>));
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
  app.use('/api', apiLimiter, api);

  // ---- serve the built SPA (single-origin production deploy) ----
  if (env.SERVE_CLIENT) {
    const clientDir = path.resolve(process.cwd(), env.CLIENT_DIR);
    if (!existsSync(path.join(clientDir, 'index.html'))) {
      logger.warn({ clientDir }, 'SERVE_CLIENT=true but no client build found - run "npm run build"');
    }
    app.use(
      express.static(clientDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    // SPA fallback: anything not /api and not a real file -> index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => res.json({ name: 'MLA FMS API', docs: '/api/docs', health: '/api/health' }));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
