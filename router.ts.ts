import { router } from './trpc.ts.js';
import { submissionRouter } from './submission.ts.js';

export const appRouter = router({ submission: submissionRouter });
export type AppRouter = typeof appRouter;
