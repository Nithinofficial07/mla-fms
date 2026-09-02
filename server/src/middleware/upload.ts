import multer from 'multer';
import { env, allowedExtensions } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const EXT_RE = /\.([a-z0-9]+)$/i;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * In-memory multer. Files are streamed straight to the storage provider by the
 * controller, never written to the app's own disk unless STORAGE_PROVIDER=local.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE, files: 20 },
  fileFilter(_req, file, cb) {
    const ext = file.originalname.match(EXT_RE)?.[1]?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      return cb(AppError.badRequest(`File type .${ext ?? '?'} is not allowed`));
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(AppError.badRequest(`Unsupported content type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});
