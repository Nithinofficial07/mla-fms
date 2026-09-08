import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env from the repo root first, then any server-local override.
for (const p of [path.resolve(process.cwd(), '../.env'), path.resolve(process.cwd(), '.env')]) {
  if (existsSync(p)) dotenv.config({ path: p });
}

/**
 * Loads and validates process env once at boot. Import `env` everywhere else -
 * never read process.env directly. Missing/invalid required vars crash the
 * process on startup with a readable message (fail fast).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  BACKEND_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.coerce.boolean().default(false),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),

  // Serve the built React app from this Node process (single-origin production
  // deploy). CLIENT_DIR may be absolute or relative to the server's CWD.
  SERVE_CLIENT: z.coerce.boolean().default(false),
  CLIENT_DIR: z.string().default('../client/dist'),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage-data'),
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024),
  ALLOWED_FILE_TYPES: z.string().default('pdf,jpg,jpeg,png,webp,doc,docx'),

  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().optional(),
  // Set for S3-compatible providers (Cloudflare R2, Backblaze B2, MinIO, Wasabi).
  // Leave blank for AWS S3.
  AWS_S3_ENDPOINT: z.string().url().optional(),
  AWS_S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  S3_SIGNED_URL_TTL: z.coerce.number().default(300),

  OCR_PROVIDER: z.enum(['none', 'tesseract', 'textract']).default('none'),

  EMAIL_PROVIDER: z.enum(['none', 'smtp']).default('none'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false), // true for port 465
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('MLA Office <no-reply@example.gov.in>'),

  SMS_PROVIDER: z.enum(['none', 'msg91', 'twilio']).default('none'),

  DEFAULT_SLA_DAYS: z.coerce.number().default(15),
  FILE_ID_FORMAT: z.string().default('MLA/{YYYY}/{SEQ:6}'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@mla.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
}).superRefine((v, ctx) => {
  if (v.STORAGE_PROVIDER === 's3' && !v.AWS_S3_BUCKET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AWS_S3_BUCKET'], message: 'Required when STORAGE_PROVIDER=s3' });
  }
  if (v.EMAIL_PROVIDER === 'smtp' && !v.SMTP_HOST) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMTP_HOST'], message: 'Required when EMAIL_PROVIDER=smtp' });
  }
  if (v.NODE_ENV === 'production') {
    if (/change-me|admin-access-secret|test-secret/.test(v.JWT_SECRET)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'Set a real random secret for production' });
    }
    if (v.JWT_SECRET === v.JWT_REFRESH_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_REFRESH_SECRET'], message: 'Must differ from JWT_SECRET' });
    }
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const allowedExtensions = env.ALLOWED_FILE_TYPES
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
