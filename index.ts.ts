import express from 'express';
import multer from 'multer';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './router.ts.js';
import { ensureSchema } from './db.ts.js';

const app = express();
const upload = multer({
 storage: multer.memoryStorage(),
 limits: { fileSize: 8 * 1024 * 1024 }
});

app.use(express.json());
app.post('/api/upload', upload.single('file'), (request, response) => {
 if (!request.file) {
  response.status(400).json({ error: 'No file uploaded' });
  return;
 }
 const dataUrl = `data:${request.file.mimetype};base64,${request.file.buffer.toString('base64')}`;
 response.json({ url: dataUrl, name: request.file.originalname, type: request.file.mimetype });
});

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
