const supabase = require('../config/supabase');

/** Schema stores the pair ordered (user1_id < user2_id) — normalize here. */
function orderedPair(a, b) {
    return a < b ? [a, b] : [b, a];
}

/**
 * GET /api/conversations
 * Returns every conversation the caller is part of, with the other participant,
 * last message preview, and unread count.
 */
exports.listConversations = async (req, res, next) => {
    try {
        const me = req.user.id;

        const { data: convos, error } = await supabase
            .from('conversations')
            .select(`
                id,
                created_at,
                user1:users!conversations_user1_id_fkey(id, username, email, avatar_url, caption),
                user2:users!conversations_user2_id_fkey(id, username, email, avatar_url, caption)
            `)
            .or(`user1_id.eq.${me},user2_id.eq.${me}`);

        if (error) throw error;

        // Pull the caller's favorites in one go so we can flag each conversation.
        const { data: favs } = await supabase
            .from('favorites')
            .select('conversation_id')
            .eq('user_id', me);
        const favSet = new Set((favs || []).map((f) => f.conversation_id));

        // Decorate each conversation with last message + unread count + favorite flag.
        const decorated = await Promise.all(
            convos.map(async (c) => {
                const other = c.user1.id === me ? c.user2 : c.user1;

                const [{ data: lastMsg }, { count: unread }] = await Promise.all([
                    supabase
                        .from('messages')
                        .select('id, message, sender_id, created_at, is_read')
                        .eq('conversation_id', c.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    supabase
                        .from('messages')
                        .select('id', { count: 'exact', head: true })
                        .eq('conversation_id', c.id)
                        .eq('is_read', false)
                        .neq('sender_id', me),
                ]);

                return {
                    id: c.id,
                    created_at: c.created_at,
                    other_user: other,
                    last_message: lastMsg || null,
                    unread_count: unread || 0,
                    is_favorite: favSet.has(c.id),
                };
            })
        );

        // Favorites first, then by recent activity.
        decorated.sort((a, b) => {
            if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
            const ta = a.last_message?.created_at || a.created_at;
            const tb = b.last_message?.created_at || b.created_at;
            return new Date(tb) - new Date(ta);
        });

        res.json({ conversations: decorated });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/conversations  { other_user_id }
 * Idempotent — returns the existing conversation if one exists.
 */
exports.getOrCreate = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { other_user_id } = req.body || {};

        if (!other_user_id) return res.status(400).json({ error: 'other_user_id is required' });
        if (other_user_id === me) return res.status(400).json({ error: 'Cannot chat with yourself' });

        // Confirm the target user exists.
        const { data: target } = await supabase
            .from('users')
            .select('id, username, email, avatar_url, caption')
            .eq('id', other_user_id)
            .maybeSingle();
        if (!target) return res.status(404).json({ error: 'User not found' });

        const [u1, u2] = orderedPair(me, other_user_id);

        const { data: existing } = await supabase
            .from('conversations')
            .select('id, created_at')
            .eq('user1_id', u1)
            .eq('user2_id', u2)
            .maybeSingle();

        if (existing) {
            return res.json({
                conversation: {
                    id: existing.id,
                    created_at: existing.created_at,
                    other_user: target,
                },
            });
        }

        const { data: created, error } = await supabase
            .from('conversations')
            .insert({ user1_id: u1, user2_id: u2 })
            .select('id, created_at')
            .single();
        if (error) throw error;

        res.status(201).json({
            conversation: {
                id: created.id,
                created_at: created.created_at,
                other_user: target,
            },
        });
    } catch (err) {
        next(err);
    }
};

/** PUT /api/conversations/:id/favorite — mark this conversation as a favorite. */
exports.favorite = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { id } = req.params;

        const convo = await exports.assertParticipant(me, id);
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });

        // Idempotent — duplicate inserts are swallowed via unique constraint.
        const { error } = await supabase
            .from('favorites')
            .upsert({ user_id: me, conversation_id: id }, { onConflict: 'user_id,conversation_id' });
        if (error) throw error;
        res.json({ ok: true, is_favorite: true });
    } catch (err) {
        next(err);
    }
};

/** DELETE /api/conversations/:id/favorite — un-favorite. */
exports.unfavorite = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { id } = req.params;

        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', me)
            .eq('conversation_id', id);
        if (error) throw error;
        res.json({ ok: true, is_favorite: false });
    } catch (err) {
        next(err);
    }
};

/** Internal helper — verify the caller is part of the conversation. */
exports.assertParticipant = async (userId, conversationId) => {
    const { data } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id')
        .eq('id', conversationId)
        .maybeSingle();
    if (!data) return null;
    if (data.user1_id !== userId && data.user2_id !== userId) return null;
    return data;
};
