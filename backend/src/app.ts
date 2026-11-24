import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import router from './modules/routes.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { env } from './config/env.js';

export const app = express();
app.disable('x-powered-by'); app.use(helmet()); app.use(cors({ origin: env.FRONTEND_ORIGIN.split(',').map((v) => v.trim()), credentials: true }));
app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.headers.cookie'] })); app.use(express.json({ limit: '2mb' }));
app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }), router);
app.use(notFound); app.use(errorHandler);
