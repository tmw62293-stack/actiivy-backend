import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  imageUrl: text('image_url'),
  userAgent: text('user_agent'),
  ip: text('ip'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow()
});
