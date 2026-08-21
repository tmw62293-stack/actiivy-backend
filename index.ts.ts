import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './router';

const app = express();
app.use(express.json());
app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext: () => ({}) }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
