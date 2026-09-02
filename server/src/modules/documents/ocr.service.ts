import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * OCR is optional and provider-pluggable. Default provider `none` is a no-op.
 * Wire tesseract.js or AWS Textract here; keep the async contract identical so
 * callers (document upload) never change.
 */
export interface OcrResult {
  text: string;
  provider: string;
}

export async function runOcr(_buffer: Buffer, mimeType: string): Promise<OcrResult | null> {
  if (env.OCR_PROVIDER === 'none') return null;
  if (!/^(image\/|application\/pdf)/.test(mimeType)) return null;
  try {
    // Placeholder: real implementation dispatches on env.OCR_PROVIDER.
    logger.info({ provider: env.OCR_PROVIDER }, 'OCR provider not implemented in scaffold; skipping');
    return null;
  } catch (err) {
    logger.error({ err }, 'OCR failed');
    return null;
  }
}
