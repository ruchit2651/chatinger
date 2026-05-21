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

    // Email (Gmail SMTP). All optional — if SMTP_USER isn't set, the email
    // module logs the OTP to the server console instead of sending so dev
    // still works without filling these in.
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: Number(process.env.SMTP_PORT) || 465,
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    EMAIL_FROM:
        process.env.EMAIL_FROM ||
        (process.env.SMTP_USER ? `Chatinger <${process.env.SMTP_USER}>` : ''),
};
