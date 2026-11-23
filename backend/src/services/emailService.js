// backend/src/services/emailService.js
//
// Transactional email, provider-abstracted.
//
// Same shape as aiProvider.js and for the same reason: no email credentials
// exist for this project yet, so the feature must be complete and wired but
// inert until configured. With EMAIL_PROVIDER=none every send is recorded as
// skipped and returns success — a missing mailer must never fail a
// registration or a password reset.
//
// Providers:
//   none    — log only (default)
//   smtp    — any SMTP host, via nodemailer if installed
//   resend  — Resend HTTP API, no dependency
//
// Recipients are never logged in bulk and BCC is used for multi-recipient
// sends, so one recipient can never see another's address.

import dotenv from 'dotenv';

dotenv.config();

const PROVIDER = (process.env.EMAIL_PROVIDER || 'none').toLowerCase();
const FROM = process.env.EMAIL_FROM || 'CSE Department <no-reply@cse.lnmiit.ac.in>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || '';
const SITE = (process.env.SITE_DOMAIN || '').replace(/\/$/, '');

export const isConfigured = () => PROVIDER !== 'none' && PROVIDER !== '';

export const providerInfo = () => ({
  provider: isConfigured() ? PROVIDER : 'none',
  from: FROM,
  configured: isConfigured(),
});

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

/** Escape interpolated values so a name containing markup cannot inject HTML. */
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Wrap body content in the department shell.
 *
 * Inline styles and a table layout, because that is what mail clients
 * reliably render — Gmail strips <style> blocks and Outlook ignores flexbox.
 */
const layout = ({ title, body, footerNote }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
  <tr><td style="background:#8B0000;padding:20px 24px;">
    <div style="color:#ffffff;font-size:16px;font-weight:600;">Computer Science &amp; Engineering</div>
    <div style="color:rgba(255,255,255,.8);font-size:12px;margin-top:2px;">The LNM Institute of Information Technology, Jaipur</div>
  </td></tr>
  <tr><td style="padding:24px;color:#18181b;font-size:15px;line-height:1.6;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#18181b;">${esc(title)}</h1>
    ${body}
  </td></tr>
  <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.5;">
    ${footerNote ? `${esc(footerNote)}<br><br>` : ''}
    ${SITE ? `<a href="${esc(SITE)}" style="color:#8B0000;">${esc(SITE)}</a><br>` : ''}
    This is an automated message — please do not reply to it.
  </td></tr>
</table>
</td></tr></table></body></html>`;

/** Plain-text fallback. Some clients and most filters prefer a text part. */
const stripHtml = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const templates = {
  eventRegistration: ({ name, eventTitle, startsAt, venue, waitlisted }) => {
    const when = startsAt
      ? new Date(startsAt).toLocaleString('en-IN', {
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : null;

    const title = waitlisted ? 'You are on the waitlist' : 'Registration confirmed';

    const body = `
      <p>Dear ${esc(name)},</p>
      <p>${
        waitlisted
          ? `This event is currently full, so you have been added to the waitlist for <strong>${esc(eventTitle)}</strong>. We will contact you if a place becomes available.`
          : `Your registration for <strong>${esc(eventTitle)}</strong> is confirmed.`
      }</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;border-collapse:collapse;">
        ${when ? `<tr><td style="padding:6px 0;color:#71717a;width:90px;">When</td><td style="padding:6px 0;">${esc(when)}</td></tr>` : ''}
        ${venue ? `<tr><td style="padding:6px 0;color:#71717a;">Venue</td><td style="padding:6px 0;">${esc(venue)}</td></tr>` : ''}
      </table>
      <p>If you can no longer attend, please let us know so the place can be offered to someone else.</p>`;

    return {
      subject: waitlisted
        ? `Waitlisted: ${eventTitle}`
        : `Registration confirmed: ${eventTitle}`,
      html: layout({
        title,
        body,
        footerNote: 'You received this because you registered for a department event.',
      }),
    };
  },

  passwordReset: ({ name, resetUrl, expiresInMinutes }) => {
    const body = `
      <p>Dear ${esc(name || 'there')},</p>
      <p>A password reset was requested for your department account. Use the button below to choose a new password.</p>
      <p style="margin:24px 0;">
        <a href="${esc(resetUrl)}" style="display:inline-block;background:#8B0000;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;">Reset your password</a>
      </p>
      <p style="color:#71717a;font-size:13px;">This link expires in ${esc(expiresInMinutes)} minutes and can be used once.</p>
      <p style="color:#71717a;font-size:13px;">If you did not request this, you can ignore this email — your password will not change.</p>`;

    return {
      subject: 'Reset your department account password',
      html: layout({ title: 'Password reset', body }),
    };
  },

  contentSubmitted: ({ submitterName, resource, title, reviewUrl }) => {
    const body = `
      <p><strong>${esc(submitterName)}</strong> submitted a change for review.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;">
        <tr><td style="padding:6px 0;color:#71717a;width:90px;">Type</td><td style="padding:6px 0;">${esc(resource)}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a;">Item</td><td style="padding:6px 0;">${esc(title)}</td></tr>
      </table>
      ${reviewUrl ? `<p style="margin:24px 0;"><a href="${esc(reviewUrl)}" style="display:inline-block;background:#8B0000;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;">Review it</a></p>` : ''}`;

    return {
      subject: `Review requested: ${title}`,
      html: layout({ title: 'Content submitted for review', body }),
    };
  },

  contentReviewed: ({ name, resource, title, approved, reason }) => {
    const body = `
      <p>Dear ${esc(name || 'there')},</p>
      <p>Your change to the ${esc(resource)} <strong>${esc(title)}</strong> was
      ${approved ? '<strong style="color:#15803d;">approved and published</strong>' : '<strong style="color:#b91c1c;">returned for revision</strong>'}.</p>
      ${reason ? `<p style="background:#fafafa;border-left:3px solid #e4e4e7;padding:12px 14px;margin:16px 0;"><strong>Reviewer note:</strong><br>${esc(reason)}</p>` : ''}
      ${approved ? '' : '<p>You can edit and resubmit it from the admin panel.</p>'}`;

    return {
      subject: approved
        ? `Approved: ${title}`
        : `Changes requested: ${title}`,
      html: layout({ title: approved ? 'Change approved' : 'Changes requested', body }),
    };
  },
};

/* ------------------------------------------------------------------ *
 * Delivery
 * ------------------------------------------------------------------ */

let transportPromise = null;

const getSmtpTransport = async () => {
  if (!transportPromise) {
    transportPromise = import('nodemailer')
      .then(({ default: nodemailer }) =>
        nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          // Port 465 is implicit TLS; 587 upgrades via STARTTLS.
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
        }),
      )
      .catch((error) => {
        transportPromise = null;
        throw new Error(
          `EMAIL_PROVIDER=smtp but nodemailer is unavailable (${error.message}). ` +
            'Run `npm install nodemailer` in backend/.',
        );
      });
  }
  return transportPromise;
};

/**
 * Send one message.
 *
 * Multiple recipients are BCC'd, so no recipient ever sees another's address.
 * Never throws: a failed send is logged and reported, because losing an email
 * must not lose the registration or the content change it accompanied.
 *
 * @returns {Promise<{sent: boolean, skipped?: boolean, provider: string, error?: string}>}
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);

  if (!recipients.length) {
    return { sent: false, provider: PROVIDER, error: 'No recipient' };
  }

  if (!isConfigured()) {
    // Deliberately inert, not broken. Log the intent so it is visible in
    // development that a message *would* have gone out.
    console.log(
      `✉️  [email skipped: EMAIL_PROVIDER=none] "${subject}" -> ${recipients.length} recipient(s)`,
    );
    return { sent: false, skipped: true, provider: 'none' };
  }

  const plain = text || stripHtml(html);

  try {
    if (PROVIDER === 'smtp') {
      const transport = await getSmtpTransport();
      await transport.sendMail({
        from: FROM,
        ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
        // One visible To (the sender) and everyone else BCC'd.
        to: recipients.length === 1 ? recipients[0] : FROM,
        ...(recipients.length > 1 ? { bcc: recipients } : {}),
        subject,
        html,
        text: plain,
      });
      return { sent: true, provider: 'smtp' };
    }

    if (PROVIDER === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM,
          to: recipients.length === 1 ? recipients : [FROM],
          ...(recipients.length > 1 ? { bcc: recipients } : {}),
          ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
          subject,
          html,
          text: plain,
        }),
      });

      if (!res.ok) {
        // Body may contain the API's reason; status alone is not actionable.
        const detail = await res.text().catch(() => '');
        throw new Error(`Resend returned ${res.status} ${detail.slice(0, 200)}`);
      }

      return { sent: true, provider: 'resend' };
    }

    throw new Error(`Unknown EMAIL_PROVIDER: ${PROVIDER}`);
  } catch (error) {
    console.error(`✉️  Email send failed ("${subject}"):`, error?.message);
    return { sent: false, provider: PROVIDER, error: error?.message };
  }
};

/** Convenience: render a template and send it. */
export const sendTemplate = async (templateName, { to, ...data }) => {
  const template = templates[templateName];
  if (!template) {
    console.error(`Unknown email template: ${templateName}`);
    return { sent: false, provider: PROVIDER, error: 'Unknown template' };
  }

  const { subject, html } = template(data);
  return sendEmail({ to, subject, html });
};
