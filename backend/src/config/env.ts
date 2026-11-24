import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/effort_tracker'), FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  APP_SETUP_PASSWORD: z.string().min(8).default('change-me-setup'), SESSION_SECRET: z.string().min(32).default('development-only-session-secret-change-me'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(720),
  LEGACY_PROJECT_PASSWORD: z.string().min(8).default('change-me-team'), LEGACY_ADMIN_PASSWORD: z.string().min(8).default('change-me-admin'),
  LEGACY_HTML_PATH: z.string().default('../portfolio-delivery-hub-COMPLETE.html'),
  UPLOAD_DIR: z.string().default('./uploads'), MAX_UPLOAD_MB: z.coerce.number().positive().default(10)
});
export const env = schema.parse(process.env);
if (env.NODE_ENV === 'production' && (env.APP_SETUP_PASSWORD.startsWith('change-me-') || env.SESSION_SECRET.startsWith('development-only-'))) {
  throw new Error('APP_SETUP_PASSWORD and SESSION_SECRET must be changed in production');
}
