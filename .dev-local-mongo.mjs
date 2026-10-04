// Persistent local MongoDB for dev, using the mongodb-memory-server binary
// cache but pointed at a real on-disk dbPath (not ephemeral) so data
// survives restarts. Listens on 127.0.0.1:27019, matching DATABASE_URL in
// .env. Run with the portable Node on PATH; Ctrl+C / process kill to stop.
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const mongod = await MongoMemoryServer.create({
  instance: {
    port: 27019,
    dbPath: path.join(dir, '.tools', 'mongo-data'),
    dbName: 'mla_fms',
    storageEngine: 'wiredTiger',
  },
  binary: { version: '7.0.24' },
});

console.log('Local MongoDB running at', mongod.getUri('mla_fms'));

process.on('SIGINT', async () => { await mongod.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await mongod.stop(); process.exit(0); });
