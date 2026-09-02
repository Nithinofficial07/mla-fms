import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startJobs, stopJobs } from './jobs/scheduler.js';

async function main() {
  await connectDb();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on ${env.BACKEND_URL} (env: ${env.NODE_ENV})`);
    logger.info(`Docs: ${env.BACKEND_URL}/api/docs`);
  });
  startJobs();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopJobs();
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
