const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');
const { signToken } = require('../utils/jwt');
const otp = require('../utils/otp');
const { sendOtp, sendWelcome } = require('../utils/email');

const SALT_ROUNDS = 10;

const publicUser = (u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    birth_date: u.birth_date,
    mobile_number: u.mobile_number,
    avatar_url: u.avatar_url,
    caption: u.caption,
    created_at: u.created_at,
});

const PROFILE_COLUMNS =
    'id, username, email, birth_date, mobile_number, avatar_url, caption, created_at';

const MAX_CAPTION_LEN = 200;
const OTP_EMAIL_TIMEOUT_MS = 12_000;

const sendOtpWithTimeout = ({ to, code, purpose }) => {
    const timeout = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Email service timed out. Try again in a moment.'));
        }, OTP_EMAIL_TIMEOUT_MS);
    });

    return Promise.race([sendOtp({ to, code, purpose }), timeout]);
};

/**
 * POST /api/auth/register/request
 * Step 1 of registration. Validates the form, checks uniqueness, hashes the
 * password, then stashes everything in an OTP row and emails a 6-digit code.
 * The user row is NOT created yet — that happens in /register/verify.
 */
exports.requestRegister = async (req, res, next) => {
    try {
        const { username, email, password, birth_date, mobile_number, caption } = req.body || {};
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'username, email and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'password must be at least 6 characters' });
        }

        let birthDateValue = null;
        if (birth_date) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
                return res.status(400).json({ error: 'birth_date must be YYYY-MM-DD' });
            }
            birthDateValue = birth_date;
        }

        let mobileValue = null;
        if (mobile_number) {
            const trimmed = String(mobile_number).trim();
            if (!/^\+?[\d\s\-()]{6,20}$/.test(trimmed)) {
                return res.status(400).json({ error: 'Invalid mobile number' });
            }
            mobileValue = trimmed;
        }

        let captionValue = null;
        if (caption) {
            const trimmed = String(caption).trim();
            if (trimmed.length > MAX_CAPTION_LEN) {
                return res.status(400).json({ error: `Caption must be ${MAX_CAPTION_LEN} characters or less` });
            }
            captionValue = trimmed || null;
        }

        const { data: byEmail } = await supabase
            .from('users').select('id').eq('email', email).maybeSingle();
        if (byEmail) return res.status(409).json({ error: 'Email already in use' });

        const { data: byUsername } = await supabase
            .from('users').select('id').eq('username', username).maybeSingle();
        if (byUsername) return res.status(409).json({ error: 'Username already taken' });

        if (mobileValue) {
            const { data: byMobile } = await supabase
                .from('users').select('id').eq('mobile_number', mobileValue).maybeSingle();
            if (byMobile) return res.status(409).json({ error: 'Mobile number already in use' });
        }

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const code = otp.generate();

        await otp.create({
            email,
            purpose: 'register',
            code,
            payload: {
                username,
                email,
                password_hash: hash,
                birth_date: birthDateValue,
                mobile_number: mobileValue,
                caption: captionValue,
            },
        });

        sendOtpWithTimeout({ to: email, code, purpose: 'register' }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('Failed to send register OTP:', err.message);
        });

        res.json({ ok: true, message: 'Verification code sent to your email' });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/register/verify
 * Step 2 of registration. Verifies the 6-digit code, creates the user row,
 * issues a JWT, and fires off the welcome email.
 */
exports.verifyRegister = async (req, res, next) => {
    try {
        const { email, code } = req.body || {};
        if (!email || !code) {
            return res.status(400).json({ error: 'email and code are required' });
        }

        const v = await otp.verify({ email, purpose: 'register', code });
        if (!v.ok) return res.status(v.status).json({ error: v.error });

        const payload = v.payload || {};

        const { data: user, error } = await supabase
            .from('users')
            .insert({
                username:      payload.username,
                email:         payload.email,
                password:      payload.password_hash,
                birth_date:    payload.birth_date,
                mobile_number: payload.mobile_number,
                caption:       payload.caption,
            })
            .select(PROFILE_COLUMNS)
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Username, email or mobile number already in use' });
            }
            throw error;
        }

        const token = signToken({ id: user.id, username: user.username, email: user.email });

        // Welcome email is best-effort.
        sendWelcome({ to: user.email, username: user.username }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('Failed to send welcome email:', err.message);
        });

        res.status(201).json({ user: publicUser(user), token });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/login/request
 * Step 1 of login. Verifies the password (so a bad password never triggers
 * an email), generates an OTP, and emails it.
 */
exports.requestLogin = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, password')
            .eq('email', email)
            .maybeSingle();
        if (error) throw error;
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        const code = otp.generate();
        await otp.create({ email, purpose: 'login', code });
        sendOtpWithTimeout({ to: email, code, purpose: 'login' }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('Failed to send login OTP:', err.message);
        });

        res.json({ ok: true, message: 'Verification code sent to your email' });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/login/verify
 * Step 2 of login. Verifies the OTP and issues the JWT.
 */
exports.verifyLogin = async (req, res, next) => {
    try {
        const { email, code } = req.body || {};
        if (!email || !code) {
            return res.status(400).json({ error: 'email and code are required' });
        }

        const v = await otp.verify({ email, purpose: 'login', code });
        if (!v.ok) return res.status(v.status).json({ error: v.error });

        const { data: user, error } = await supabase
            .from('users')
            .select(PROFILE_COLUMNS)
            .eq('email', email)
            .maybeSingle();
        if (error) throw error;
        if (!user) return res.status(401).json({ error: 'Account not found' });

        const token = signToken({ id: user.id, username: user.username, email: user.email });
        res.json({ user: publicUser(user), token });
    } catch (err) {
        next(err);
    }
};

exports.me = async (req, res, next) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select(PROFILE_COLUMNS)
            .eq('id', req.user.id)
            .single();
        if (error) throw error;
        res.json({ user: publicUser(user) });
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/auth/me
 * Body: { username?, birth_date?, mobile_number?, avatar_url?, caption? }
 * Email and password are intentionally not editable here.
 */
exports.updateMe = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { username, birth_date, mobile_number, avatar_url, caption } = req.body || {};

        const patch = {};

        if (username !== undefined) {
            const trimmed = String(username).trim();
            if (trimmed.length < 2 || trimmed.length > 40) {
                return res.status(400).json({ error: 'Username must be 2-40 characters' });
            }
            const { data: clash } = await supabase
                .from('users')
                .select('id')
                .eq('username', trimmed)
                .neq('id', me)
                .maybeSingle();
            if (clash) return res.status(409).json({ error: 'Username already taken' });
            patch.username = trimmed;
        }

        if (birth_date !== undefined) {
            if (birth_date === '' || birth_date === null) {
                patch.birth_date = null;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
                patch.birth_date = birth_date;
            } else {
                return res.status(400).json({ error: 'birth_date must be YYYY-MM-DD' });
            }
        }

        if (mobile_number !== undefined) {
            const trimmed = String(mobile_number).trim();
            if (trimmed === '') {
                patch.mobile_number = null;
            } else if (!/^\+?[\d\s\-()]{6,20}$/.test(trimmed)) {
                return res.status(400).json({ error: 'Invalid mobile number' });
            } else {
                // Uniqueness check — must not be taken by another user.
                const { data: clash } = await supabase
                    .from('users')
                    .select('id')
                    .eq('mobile_number', trimmed)
                    .neq('id', me)
                    .maybeSingle();
                if (clash) {
                    return res.status(409).json({ error: 'Mobile number already in use' });
                }
                patch.mobile_number = trimmed;
            }
        }

        if (avatar_url !== undefined) {
            if (avatar_url === '' || avatar_url === null) {
                patch.avatar_url = null;
            } else if (typeof avatar_url !== 'string' || !/^https?:\/\//i.test(avatar_url)) {
                return res.status(400).json({ error: 'avatar_url must be an http(s) URL' });
            } else {
                patch.avatar_url = avatar_url;
            }
        }

        if (caption !== undefined) {
            if (caption === null) {
                patch.caption = null;
            } else {
                const trimmed = String(caption).trim();
                if (trimmed.length > MAX_CAPTION_LEN) {
                    return res.status(400).json({ error: `Caption must be ${MAX_CAPTION_LEN} characters or less` });
                }
                patch.caption = trimmed || null;
            }
        }

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ error: 'Nothing to update' });
        }

        const { data: updated, error } = await supabase
            .from('users')
            .update(patch)
            .eq('id', me)
            .select(PROFILE_COLUMNS)
            .single();
        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Username or mobile number already in use' });
            }
            throw error;
        }

        res.json({ user: publicUser(updated) });
    } catch (err) {
        next(err);
    }
};
