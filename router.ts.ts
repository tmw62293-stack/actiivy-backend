import { router } from '@trpc/server';
import { submissionRouter } from './submission';
export const appRouter = router({ submission: submissionRouter });
export type AppRouter = typeof appRouter;
