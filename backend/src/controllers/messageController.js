const supabase = require('../config/supabase');
const { assertParticipant } = require('./conversationController');
const push = require('../utils/push');

const MESSAGE_COLUMNS =
    'id, conversation_id, sender_id, message, is_read, created_at, ' +
    'edited_at, deleted_at, reply_to_id, attachment_url, attachment_type, attachment_name';

/** Fetch reactions for an array of message IDs, returning a Map<msgId, Reaction[]>. */
async function loadReactionsFor(messageIds) {
    if (!messageIds || messageIds.length === 0) return new Map();
    const { data, error } = await supabase
        .from('reactions')
        .select('id, message_id, user_id, emoji, created_at')
        .in('message_id', messageIds);
    if (error) throw error;
    const byMsg = new Map();
    for (const r of data || []) {
        if (!byMsg.has(r.message_id)) byMsg.set(r.message_id, []);
        byMsg.get(r.message_id).push(r);
    }
    return byMsg;
}

/** GET /api/messages/:conversationId — full chat history (oldest -> newest). */
exports.getHistory = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { conversationId } = req.params;

        const convo = await assertParticipant(me, conversationId);
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });

        const { data, error } = await supabase
            .from('messages')
            .select(MESSAGE_COLUMNS)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const reactionMap = await loadReactionsFor((data || []).map((m) => m.id));
        const decorated = (data || []).map((m) => ({
            ...m,
            reactions: reactionMap.get(m.id) || [],
        }));
        res.json({ messages: decorated });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/messages
 * Body: { conversation_id, message, reply_to_id?, attachment_url?, attachment_type?, attachment_name? }
 * A message may have empty text if an attachment is provided.
 */
exports.sendMessage = async (req, res, next) => {
    try {
        const me = req.user.id;
        const {
            conversation_id,
            message,
            reply_to_id,
            attachment_url,
            attachment_type,
            attachment_name,
        } = req.body || {};

        if (!conversation_id) {
            return res.status(400).json({ error: 'conversation_id is required' });
        }
        const text = (message || '').trim();
        if (!text && !attachment_url) {
            return res.status(400).json({ error: 'message or attachment is required' });
        }

        const convo = await assertParticipant(me, conversation_id);
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });

        // Reply target must be in the same conversation.
        if (reply_to_id) {
            const { data: replyTarget } = await supabase
                .from('messages')
                .select('id, conversation_id')
                .eq('id', reply_to_id)
                .maybeSingle();
            if (!replyTarget || replyTarget.conversation_id !== conversation_id) {
                return res.status(400).json({ error: 'Invalid reply_to_id' });
            }
        }

        const { data: saved, error } = await supabase
            .from('messages')
            .insert({
                conversation_id,
                sender_id: me,
                message: text,
                is_read: false,
                reply_to_id: reply_to_id || null,
                attachment_url: attachment_url || null,
                attachment_type: attachment_type || null,
                attachment_name: attachment_name || null,
            })
            .select(MESSAGE_COLUMNS)
            .single();
        if (error) throw error;

        const payload = {
            ...saved,
            reactions: [],
            sender_username: req.user.username,
        };

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${convo.user1_id}`)
                .to(`user:${convo.user2_id}`)
                .emit('receive_message', payload);
        }

        // Fire a Web Push to the *other* participant so they get a notification
        // even when the tab is closed. Fire-and-forget — the response shouldn't
        // wait on the push services.
        const recipientId = convo.user1_id === me ? convo.user2_id : convo.user1_id;
        push.sendToUser(recipientId, {
            title: `Chatinger · ${req.user.username}`,
            body: text || (attachment_url ? 'Sent an attachment' : 'New message'),
            conversation_id,
            message_id: saved.id,
        }).catch((err) => {
            console.error('[push] dispatch failed:', err.message);
        });

        res.status(201).json({ message: payload });
    } catch (err) {
        next(err);
    }
};

/** PATCH /api/messages/:id — edit message text (owner only). */
exports.editMessage = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { id } = req.params;
        const text = (req.body?.message || '').trim();
        if (!text) return res.status(400).json({ error: 'message is required' });

        const { data: existing } = await supabase
            .from('messages')
            .select('id, sender_id, conversation_id, deleted_at')
            .eq('id', id)
            .maybeSingle();
        if (!existing) return res.status(404).json({ error: 'Message not found' });
        if (existing.sender_id !== me) return res.status(403).json({ error: 'Not your message' });
        if (existing.deleted_at) return res.status(400).json({ error: 'Message is deleted' });

        const convo = await assertParticipant(me, existing.conversation_id);
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });

        const { data: updated, error } = await supabase
            .from('messages')
            .update({ message: text, edited_at: new Date().toISOString() })
            .eq('id', id)
            .select(MESSAGE_COLUMNS)
            .single();
        if (error) throw error;

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${convo.user1_id}`)
                .to(`user:${convo.user2_id}`)
                .emit('message_updated', updated);
        }

        res.json({ message: updated });
    } catch (err) {
        next(err);
    }
};

/** DELETE /api/messages/:id — soft-delete (owner only). */
exports.deleteMessage = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { id } = req.params;

        const { data: existing } = await supabase
            .from('messages')
            .select('id, sender_id, conversation_id, deleted_at')
            .eq('id', id)
            .maybeSingle();
        if (!existing) return res.status(404).json({ error: 'Message not found' });
        if (existing.sender_id !== me) return res.status(403).json({ error: 'Not your message' });
        if (existing.deleted_at) return res.json({ ok: true });

        const convo = await assertParticipant(me, existing.conversation_id);
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });

        const { data: updated, error } = await supabase
            .from('messages')
            .update({
                deleted_at: new Date().toISOString(),
                message: '',
                attachment_url: null,
                attachment_type: null,
                attachment_name: null,
            })
            .eq('id', id)
            .select(MESSAGE_COLUMNS)
            .single();
        if (error) throw error;

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${convo.user1_id}`)
                .to(`user:${convo.user2_id}`)
                .emit('message_updated', updated);
        }

        res.json({ message: updated });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/messages/search/all?q=...
 * Full-text-ish search across all of the caller's conversations.
 * Matches are case-insensitive substring. Results capped at 50.
 */
exports.searchMessages = async (req, res, next) => {
    try {
        const me = req.user.id;
        const q = (req.query.q || '').trim();
        if (!q) return res.json({ results: [] });

        // Get the user's conversation IDs first — we'll only search inside those.
        const { data: convos, error: convErr } = await supabase
            .from('conversations')
            .select('id, user1:users!conversations_user1_id_fkey(id, username), user2:users!conversations_user2_id_fkey(id, username)')
            .or(`user1_id.eq.${me},user2_id.eq.${me}`);
        if (convErr) throw convErr;
        if (!convos || convos.length === 0) return res.json({ results: [] });

        const convoMap = new Map();
        for (const c of convos) {
            const other = c.user1.id === me ? c.user2 : c.user1;
            convoMap.set(c.id, other);
        }

        // ilike with %q% is safe through PostgREST's query builder; user input
        // is parameterized by supabase-js, not concatenated into SQL.
        const { data: matches, error: msgErr } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, message, created_at')
            .in('conversation_id', Array.from(convoMap.keys()))
            .ilike('message', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(50);
        if (msgErr) throw msgErr;

        const results = (matches || []).map((m) => ({
            ...m,
            other_user: convoMap.get(m.conversation_id) || null,
        }));

        res.json({ results });
    } catch (err) {
        next(err);
    }
};

/** PATCH /api/messages/:conversationId/read — mark every inbound msg as read. */
exports.markRead = async (req, res, next) => {
    try {
        const me = req.user.id;
        const { conversationId } = req.params;

        const convo = await assertParticipant(me, conversationId);
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });

        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', me)
            .eq('is_read', false);
        if (error) throw error;

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${convo.user1_id}`)
                .to(`user:${convo.user2_id}`)
                .emit('messages_read', {
                    conversation_id: conversationId,
                    reader_id: me,
                });
        }

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
