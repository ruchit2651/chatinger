import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import MessageBubble from './MessageBubble.jsx';
import MessageInput from './MessageInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import Avatar from './Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import {
    getHistory,
    sendMessage,
    markRead,
    editMessage,
    deleteMessage,
} from '../api/messages.js';
import {
    addReaction,
    removeReaction,
} from '../api/reactions.js';

const TYPING_TIMEOUT = 2500;

export default function ChatWindow({
    conversation,
    onMessageSent,
    onOpenSidebar,
    onReadAll,
}) {
    const { user } = useAuth();
    const { socket, onlineUsers } = useSocket();
    const other = conversation.other_user;
    const isOtherOnline = onlineUsers.includes(other.id);

    const [messages, setMessages] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [typing, setTyping]     = useState(false);
    const [replyTo, setReplyTo]   = useState(null);   // message being replied to
    const [scrolledUp, setScrolledUp] = useState(false);
    const [newCount, setNewCount]     = useState(0);  // unread arrivals while scrolled up

    const scrollRef = useRef(null);
    const typingTimerRef = useRef(null);
    const messageRefs = useRef(new Map()); // id -> DOM node
    const stickToBottomRef = useRef(true); // are we currently anchored to the latest?

    const SCROLL_THRESHOLD = 120;

    const scrollToBottom = useCallback((behavior = 'smooth') => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior });
        stickToBottomRef.current = true;
        setScrolledUp(false);
        setNewCount(0);
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const nearBottom = distanceFromBottom < SCROLL_THRESHOLD;
        stickToBottomRef.current = nearBottom;
        setScrolledUp(!nearBottom);
        if (nearBottom) setNewCount(0);
    }, []);

    const conversationId = conversation.id;

    // Index by id for O(1) reply-quote lookup.
    const messagesById = useMemo(() => {
        const m = new Map();
        for (const msg of messages) m.set(msg.id, msg);
        return m;
    }, [messages]);

    // Load history + join socket room each time the conversation changes.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setMessages([]);
        setReplyTo(null);

        (async () => {
            try {
                const msgs = await getHistory(conversationId);
                if (cancelled) return;
                setMessages(msgs);
                await markRead(conversationId).catch(() => {});
                onReadAll?.();
            } catch (err) {
                if (!cancelled) toast.error(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        if (socket) socket.emit('join', { conversation_id: conversationId });

        return () => {
            cancelled = true;
            if (socket) socket.emit('leave', { conversation_id: conversationId });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

    // Socket events scoped to this conversation.
    useEffect(() => {
        if (!socket) return;

        const onReceive = (msg) => {
            if (msg.conversation_id !== conversationId) return;
            setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            // If the user is scrolled up and this is an inbound message,
            // bump the "new messages" badge on the scroll-to-bottom button.
            if (msg.sender_id !== user.id) {
                if (!stickToBottomRef.current) {
                    setNewCount((n) => n + 1);
                }
                markRead(conversationId).catch(() => {});
                onReadAll?.();
            }
        };

        const onUpdated = (msg) => {
            if (msg.conversation_id !== conversationId) return;
            setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))
            );
        };

        const onReaction = ({ action, reaction, message_id, conversation_id }) => {
            if (conversation_id !== conversationId) return;
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id !== message_id) return m;
                    const current = m.reactions || [];
                    if (action === 'add') {
                        if (current.some((r) => r.id === reaction.id)) return m;
                        return { ...m, reactions: [...current, reaction] };
                    }
                    if (action === 'remove') {
                        return {
                            ...m,
                            reactions: current.filter(
                                (r) => !(r.user_id === reaction.user_id && r.emoji === reaction.emoji)
                            ),
                        };
                    }
                    return m;
                })
            );
        };

        const onTyping = ({ conversation_id, user_id }) => {
            if (conversation_id !== conversationId || user_id === user.id) return;
            setTyping(true);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => setTyping(false), TYPING_TIMEOUT);
        };

        const onStopTyping = ({ conversation_id, user_id }) => {
            if (conversation_id !== conversationId || user_id === user.id) return;
            setTyping(false);
        };

        const onRead = ({ conversation_id, reader_id }) => {
            if (conversation_id !== conversationId) return;
            if (reader_id !== user.id) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.sender_id === user.id && !m.is_read ? { ...m, is_read: true } : m
                    )
                );
            }
        };

        socket.on('receive_message',  onReceive);
        socket.on('message_updated',  onUpdated);
        socket.on('reaction_changed', onReaction);
        socket.on('typing',           onTyping);
        socket.on('stop_typing',      onStopTyping);
        socket.on('messages_read',    onRead);

        return () => {
            socket.off('receive_message',  onReceive);
            socket.off('message_updated',  onUpdated);
            socket.off('reaction_changed', onReaction);
            socket.off('typing',           onTyping);
            socket.off('stop_typing',      onStopTyping);
            socket.off('messages_read',    onRead);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        };
    }, [socket, conversationId, user.id, onReadAll]);

    // Auto-scroll to the latest message only if the user was already anchored
    // to the bottom. Otherwise leave their scroll position alone — the "↓"
    // button handles the catch-up.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (stickToBottomRef.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages, typing]);

    // Reset stickiness when the conversation changes — always start at bottom.
    useEffect(() => {
        stickToBottomRef.current = true;
        setScrolledUp(false);
        setNewCount(0);
    }, [conversationId]);

    const handleSend = useCallback(
        async (text, extra = {}) => {
            try {
                const payload = { ...extra };
                if (replyTo) payload.reply_to_id = replyTo.id;
                const saved = await sendMessage(conversationId, text, payload);
                setMessages((prev) => {
                    if (prev.some((m) => m.id === saved.id)) return prev;
                    return [...prev, saved];
                });
                onMessageSent?.(saved);
                setReplyTo(null);
            } catch (err) {
                toast.error(err.message);
            }
        },
        [conversationId, onMessageSent, replyTo]
    );

    const handleEdit = useCallback(async (id, text) => {
        try {
            const updated = await editMessage(id, text);
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
        } catch (err) {
            toast.error(err.message);
        }
    }, []);

    const handleDelete = useCallback(async (id) => {
        if (!confirm('Delete this message?')) return;
        try {
            const updated = await deleteMessage(id);
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
        } catch (err) {
            toast.error(err.message);
        }
    }, []);

    const handleReact = useCallback(async (messageId, emoji) => {
        const msg = messagesById.get(messageId);
        const already = msg?.reactions?.some(
            (r) => r.user_id === user.id && r.emoji === emoji
        );
        try {
            if (already) await removeReaction(messageId, emoji);
            else await addReaction(messageId, emoji);
        } catch (err) {
            toast.error(err.message);
        }
    }, [messagesById, user.id]);

    const handleJumpTo = useCallback((id) => {
        const node = messageRefs.current.get(id);
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.classList.add('ring-2', 'ring-brand-400');
            setTimeout(() => node.classList.remove('ring-2', 'ring-brand-400'), 1500);
        }
    }, []);

    const onTyping     = useCallback(() => socket?.emit('typing',      { conversation_id: conversationId }), [socket, conversationId]);
    const onStopTyping = useCallback(() => socket?.emit('stop_typing', { conversation_id: conversationId }), [socket, conversationId]);

    return (
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 min-w-0">
            {/* Header */}
            <header className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 shadow-sm">
                <button
                    onClick={onOpenSidebar}
                    className="md:hidden text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 -ml-2"
                    aria-label="Open sidebar"
                >
                    ☰
                </button>
                <Avatar
                    name={other.username}
                    imageUrl={other.avatar_url}
                    online={isOtherOnline}
                />
                <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{other.username}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {other.caption || (isOtherOnline ? 'Online' : 'Offline')}
                    </p>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 relative min-h-0">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="absolute inset-0 overflow-y-auto chat-scroll px-3 md:px-6 py-4 space-y-2"
            >
                {loading ? (
                    <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                        Loading messages...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                        Say hello to {other.username} 👋
                    </div>
                ) : (
                    messages.map((m) => (
                        <div
                            key={m.id}
                            ref={(node) => {
                                if (node) messageRefs.current.set(m.id, node);
                                else messageRefs.current.delete(m.id);
                            }}
                            className="rounded-2xl transition"
                        >
                            <MessageBubble
                                message={m}
                                mine={m.sender_id === user.id}
                                myUserId={user.id}
                                repliedMessage={m.reply_to_id ? messagesById.get(m.reply_to_id) : null}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onReply={(msg) => setReplyTo(msg)}
                                onReact={handleReact}
                                onJumpTo={handleJumpTo}
                            />
                        </div>
                    ))
                )}
                {typing && <TypingIndicator username={other.username} />}
            </div>

            {/* Floating "scroll to bottom" button */}
            {scrolledUp && (
                <button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-11 h-11 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-md flex items-center justify-center text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
                    aria-label="Scroll to latest"
                    title="Scroll to latest"
                >
                    <span className="text-lg leading-none">↓</span>
                    {newCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-brand-600 text-white text-[11px] font-semibold flex items-center justify-center">
                            {newCount > 99 ? '99+' : newCount}
                        </span>
                    )}
                </button>
            )}
            </div>

            <MessageInput
                onSend={handleSend}
                onTyping={onTyping}
                onStopTyping={onStopTyping}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                conversationId={conversationId}
            />
        </div>
    );
}
