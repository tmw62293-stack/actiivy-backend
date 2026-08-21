import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './router.ts.js';
import { ensureSchema } from './db.ts.js';

const app = express();
app.use(express.json());
app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: () => ({}),
  onError({ path, error }) {
    console.error(`[tRPC] ${path ?? 'unknown'} failed`, error);
  }
}));

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await ensureSchema();
    console.log('✅ Database schema ready');
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    process.exit(1);
  }
}

void start();
