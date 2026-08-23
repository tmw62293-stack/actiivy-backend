import { router } from './trpc.ts.js';

import { submissionRouter, cardRouter } from './submission.ts.js';

export const appRouter = router({
  submission: submissionRouter,
  cards: cardRouter
});
export type AppRouter = typeof appRouter;
