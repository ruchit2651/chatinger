const required = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
    }
}

// CORS allowlist. Accepts a single URL or comma-separated list — useful when
// the same backend serves a localhost dev frontend AND a Netlify production
// frontend at the same time.
const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = {
    APP_NAME: process.env.APP_NAME || 'Chatinger',
    PORT: Number(process.env.PORT) || 5000,
    CLIENT_URL: CLIENT_URLS[0],
    CLIENT_URLS,
    JWT_SECRET: process.env.JWT_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

    // Email — Brevo HTTPS API (https://www.brevo.com). We use HTTP rather
    // than SMTP because Render blocks outbound SMTP. If BREVO_API_KEY is
    // empty, the email module logs OTPs to the server console instead so
    // local dev still works without credentials.
    BREVO_API_KEY: process.env.BREVO_API_KEY || '',
    EMAIL_SENDER_EMAIL:
        process.env.EMAIL_SENDER_EMAIL || process.env.SMTP_USER || '',
    EMAIL_SENDER_NAME:
        process.env.EMAIL_SENDER_NAME || process.env.APP_NAME || 'Chatinger',

    // Web Push (VAPID). Generate a keypair once with `node generate-vapid.js`
    // and store the two halves here. Leave empty to disable push notifications.
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
    VAPID_SUBJECT:
        process.env.VAPID_SUBJECT ||
        (process.env.EMAIL_SENDER_EMAIL
            ? `mailto:${process.env.EMAIL_SENDER_EMAIL}`
            : 'mailto:admin@example.com'),
};
