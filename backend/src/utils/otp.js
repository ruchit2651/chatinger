const crypto = require('crypto');
const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');

const OTP_LIFETIME_MIN = 10;
const MAX_ATTEMPTS     = 5;
const SALT_ROUNDS      = 8;

/** Generate a cryptographically random 6-digit code. */
exports.generate = () => {
    const n = crypto.randomInt(0, 1_000_000);
    return n.toString().padStart(6, '0');
};

/**
 * Create + store a new OTP row. Any older codes for the same email+purpose
 * are deleted so only the latest is valid.
 */
exports.create = async ({ email, purpose, code, payload }) => {
    await supabase
        .from('otp_codes')
        .delete()
        .eq('email', email)
        .eq('purpose', purpose);

    const code_hash = await bcrypt.hash(code, SALT_ROUNDS);
    const expires_at = new Date(Date.now() + OTP_LIFETIME_MIN * 60_000).toISOString();

    const { error } = await supabase
        .from('otp_codes')
        .insert({ email, purpose, code_hash, payload: payload || null, expires_at });
    if (error) throw error;
};

/**
 * Verify a code. Returns { ok: true, payload } on success.
 * On failure returns { ok: false, status, error } with an HTTP status hint.
 * Also bumps the attempt counter; after MAX_ATTEMPTS the code is deleted.
 */
exports.verify = async ({ email, purpose, code }) => {
    const { data: row } = await supabase
        .from('otp_codes')
        .select('id, code_hash, payload, expires_at, attempts')
        .eq('email', email)
        .eq('purpose', purpose)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!row) {
        return { ok: false, status: 400, error: 'No code requested. Request a new one.' };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
        await supabase.from('otp_codes').delete().eq('id', row.id);
        return { ok: false, status: 400, error: 'Code expired. Request a new one.' };
    }
    if (row.attempts >= MAX_ATTEMPTS) {
        await supabase.from('otp_codes').delete().eq('id', row.id);
        return { ok: false, status: 429, error: 'Too many attempts. Request a new code.' };
    }

    const matches = await bcrypt.compare(String(code || ''), row.code_hash);
    if (!matches) {
        await supabase
            .from('otp_codes')
            .update({ attempts: row.attempts + 1 })
            .eq('id', row.id);
        return { ok: false, status: 400, error: 'Incorrect code' };
    }

    // Single-use: consume on success.
    await supabase.from('otp_codes').delete().eq('id', row.id);
    return { ok: true, payload: row.payload };
};
