const env = require('../config/env');

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/**
 * Send an email via Brevo's HTTPS API. We use HTTP rather than SMTP because
 * Render blocks outbound SMTP connections — only HTTPS gets out.
 *
 * If BREVO_API_KEY isn't set, falls back to logging the email to the console
 * so local dev works without credentials (the OTP is recoverable from the log).
 */
async function send({ to, subject, html, text }) {
    if (!env.BREVO_API_KEY) {
        console.log(
            `\n[email:devmode] BREVO_API_KEY not set. Would have sent:\n` +
            `  to:      ${to}\n` +
            `  subject: ${subject}\n` +
            `  text:    ${text}\n`
        );
        return { devMode: true };
    }

    const payload = {
        sender: { name: env.EMAIL_SENDER_NAME, email: env.EMAIL_SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    let resp;
    try {
        resp = await fetch(BREVO_ENDPOINT, {
            method: 'POST',
            headers: {
                'api-key': env.BREVO_API_KEY,
                'accept': 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }

    const body = await resp.text();
    if (!resp.ok) {
        throw new Error(`Brevo ${resp.status}: ${body}`);
    }
    return body ? JSON.parse(body) : {};
}

const APP = env.APP_NAME;

const wrap = (innerHtml) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:32px 16px;color:#0f172a">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:20px 24px;color:#ffffff">
            <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px">${APP}</span>
            </div>
        </div>
        <div style="padding:24px 28px;font-size:14px;line-height:1.55">
            ${innerHtml}
        </div>
        <div style="padding:16px 28px;background:#f1f5f9;color:#64748b;font-size:11px;text-align:center">
            You're receiving this email because someone used this address on ${APP}.
            If that wasn't you, ignore this message.
        </div>
    </div>
</div>`;

exports.sendOtp = async ({ to, code, purpose }) => {
    const purposeText =
        purpose === 'register' ? 'create your account' :
        purpose === 'login'    ? 'sign in' :
        'verify your email';

    const subject = `${APP} verification code: ${code}`;
    const html = wrap(`
        <p style="margin:0 0 8px;font-size:16px"><strong>Your ${APP} code</strong></p>
        <p style="margin:0 0 20px;color:#475569">
            Use the code below to ${purposeText}. It expires in 10 minutes.
        </p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#eff6ff;color:#1d4ed8;padding:16px 0;text-align:center;border-radius:12px;border:1px dashed #93c5fd">
            ${code}
        </div>
        <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">
            Don't share this code with anyone. ${APP} support will never ask for it.
        </p>
    `);
    const text = `Your ${APP} code is ${code}. It expires in 10 minutes.`;
    return send({ to, subject, html, text });
};

exports.sendWelcome = async ({ to, username }) => {
    const subject = `Welcome to ${APP}, ${username}!`;
    const html = wrap(`
        <p style="margin:0 0 8px;font-size:18px"><strong>Welcome aboard, ${username}!</strong></p>
        <p style="margin:0 0 16px;color:#475569">
            Your ${APP} account is ready. Real-time, end-to-end chat is one click away.
        </p>
        <p style="margin:0 0 16px;color:#475569">
            Here's how to get started:
        </p>
        <ul style="margin:0 0 16px;padding-left:20px;color:#475569">
            <li>Tap <strong>+ Start new chat</strong> and search a friend by their mobile number.</li>
            <li>Set a profile photo and a short caption to introduce yourself.</li>
            <li>Star your favorite conversations to keep them pinned at the top.</li>
        </ul>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">
            Happy chatting,<br/>
            The ${APP} team
        </p>
    `);
    const text = `Welcome to ${APP}, ${username}! Your account is ready — open the app and start chatting.`;
    return send({ to, subject, html, text });
};
