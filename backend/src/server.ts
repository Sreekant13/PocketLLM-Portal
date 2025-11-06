import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import db from './services/db';

import generate from './routes/generate';
import sessions from './routes/sessions';
import cache from './routes/cache';
import admin from './routes/admin';

async function main() {
  // Always ensure schema (safe: tables use IF NOT EXISTS)
  const schemaPath = path.join(__dirname, 'schema.sql'); // schema at backend/schema.sql
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.register(generate);
  app.register(sessions);
  app.register(cache);
  app.register(admin);

  await app.listen({ port: 3001, host: '0.0.0.0' });
  app.log.info('Backend listening on http://localhost:3001');
}

main().catch((err) => { console.error(err); process.exit(1); });

// import Fastify from 'fastify';
// import cors from '@fastify/cors';
// import fs from 'fs';
// import db from './services/db';

// import generate from './routes/generate';
// import sessions from './routes/sessions';
// import cache from './routes/cache';
// import admin from './routes/admin';

// async function main() {
//   // Ensure DB schema on first run
//   if (!fs.existsSync('pocketllm.db')) {
//     const schema = fs.readFileSync('schema.sql','utf8');
//     db.exec(schema);
//   }

//   const app = Fastify({ logger: true });

//   await app.register(cors, { origin: true });

//   app.register(generate);
//   app.register(sessions);
//   app.register(cache);
//   app.register(admin);

//   await app.listen({ port: 3001, host: '0.0.0.0' });
//   app.log.info('Backend listening on http://localhost:3001');
// }
// main().catch((e)=>{ console.error(e); process.exit(1); });
