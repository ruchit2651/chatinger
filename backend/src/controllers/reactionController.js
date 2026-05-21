const supabase = require('../config/supabase');
const { assertParticipant } = require('./conversationController');

/**
 * Look up the message + its conversation, and verify the caller is part of it.
 * Returns { message, convo } or null.
 */
async function loadMessageForCaller(userId, messageId) {
    const { data: msg } = await supabase
        .from('messages')
        .select('id, conversation_id')
        .eq('id', messageId)
        .maybeSingle();
    if (!msg) return null;
    const convo = await assertParticipant(userId, msg.conversation_id);
    if (!convo) return null;
    return { message: msg, convo };
}

/** POST /api/reactions { message_id, emoji } */
exports.addReaction = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { message_id, emoji } = req.body || {};
        if (!message_id || !emoji) {
            return res.status(400).json({ error: 'message_id and emoji are required' });
        }

        const ctx = await loadMessageForCaller(me, message_id);
        if (!ctx) return res.status(404).json({ error: 'Message not found' });

        // Idempotent insert: if it already exists, just return it.
        const { data: existing } = await supabase
            .from('reactions')
            .select('id, message_id, user_id, emoji, created_at')
            .eq('message_id', message_id)
            .eq('user_id', me)
            .eq('emoji', emoji)
            .maybeSingle();

        let reaction = existing;
        if (!reaction) {
            const { data: inserted, error } = await supabase
                .from('reactions')
                .insert({ message_id, user_id: me, emoji })
                .select('id, message_id, user_id, emoji, created_at')
                .single();
            if (error) throw error;
            reaction = inserted;
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${ctx.convo.user1_id}`)
                .to(`user:${ctx.convo.user2_id}`)
                .emit('reaction_changed', {
                    action: 'add',
                    reaction,
                    message_id,
                    conversation_id: ctx.convo.id,
                });
        }

        res.status(201).json({ reaction });
    } catch (err) {
        next(err);
    }
};

/** DELETE /api/reactions  { message_id, emoji } — remove caller's reaction. */
exports.removeReaction = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { message_id, emoji } = req.body || {};
        if (!message_id || !emoji) {
            return res.status(400).json({ error: 'message_id and emoji are required' });
        }

        const ctx = await loadMessageForCaller(me, message_id);
        if (!ctx) return res.status(404).json({ error: 'Message not found' });

        const { error } = await supabase
            .from('reactions')
            .delete()
            .eq('message_id', message_id)
            .eq('user_id', me)
            .eq('emoji', emoji);
        if (error) throw error;

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${ctx.convo.user1_id}`)
                .to(`user:${ctx.convo.user2_id}`)
                .emit('reaction_changed', {
                    action: 'remove',
                    reaction: { user_id: me, emoji },
                    message_id,
                    conversation_id: ctx.convo.id,
                });
        }

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
