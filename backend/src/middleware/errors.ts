import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
export const notFound: RequestHandler = (_req, res) => { res.status(404).json({ error: 'not_found' }); };
export const errorHandler: ErrorRequestHandler = (error: any, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ error: 'validation_failed', issues: error.issues }); return; }
  if (error?.name === 'VersionError') { res.status(409).json({ error: 'version_conflict', message: 'This record changed. Reload before saving.' }); return; }
  const status = Number(error?.status) || 500;
  res.status(status).json({ error: status === 500 ? 'internal_error' : 'request_failed', message: status === 500 ? 'The request could not be completed.' : error.message });
};
