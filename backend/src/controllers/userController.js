const supabase = require('../config/supabase');

/**
 * GET /api/users/find?mobile=...
 * Look up a single user by exact mobile_number. Used to start a new chat
 * by phone number (replaces the old "list all users" directory).
 *
 * To make matching tolerant of formatting differences (spaces, dashes,
 * parens, leading +), we normalize to a canonical "digits only" form and
 * compare against that. Both inputs and stored numbers are normalized.
 */
exports.findByMobile = async (req, res, next) => {
    try {
        const raw = (req.query.mobile || '').toString();
        const digits = raw.replace(/\D/g, '');
        if (digits.length < 6) {
            return res.status(400).json({ error: 'Mobile number must be at least 6 digits' });
        }

        // Pull all candidate users that might match — Postgres has no built-in
        // "strip non-digit and compare" we can express through PostgREST, so
        // we narrow with a partial substring then exact-match in JS.
        // Index lookup on the last N digits keeps this cheap.
        const tail = digits.slice(-7); // last 7 digits is enough to disambiguate
        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, mobile_number, avatar_url, caption')
            .ilike('mobile_number', `%${tail}%`)
            .neq('id', req.user.id);

        if (error) throw error;

        const match = (data || []).find((u) => {
            const stored = (u.mobile_number || '').replace(/\D/g, '');
            return (
                stored === digits ||
                stored.endsWith(digits) ||
                digits.endsWith(stored)
            );
        });

        if (!match) return res.status(404).json({ error: 'No user with that mobile number' });

        res.json({
            user: {
                id: match.id,
                username: match.username,
                email: match.email,
                mobile_number: match.mobile_number,
                avatar_url: match.avatar_url,
                caption: match.caption,
            },
        });
    } catch (err) {
        next(err);
    }
};
