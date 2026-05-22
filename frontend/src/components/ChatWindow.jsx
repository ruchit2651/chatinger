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
import { getHidden, hideMessages } from '../utils/hiddenMessages.js';

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
    const [selectedIds, setSelectedIds]   = useState(() => new Set());
    const [hiddenIds, setHiddenIds]       = useState(() => getHidden(user.id));
    // Delete dialog state: { open, ids: number[], canEveryone: boolean }
    const [deleteDialog, setDeleteDialog] = useState({ open: false, ids: [], canEveryone: false });
    const selectionMode = selectedIds.size > 0;

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

    // Refresh local hide-list when the signed-in user changes (logout / login
    // as a different account in the same tab).
    useEffect(() => {
        setHiddenIds(getHidden(user.id));
    }, [user.id]);

    // Visible messages = everything except the ones the current user has
    // chosen to "delete for me" locally. Reply quotes still need to look up
    // the original (it's just hidden from the main list), so messagesById is
    // built from the unfiltered set.
    const visibleMessages = useMemo(
        () => messages.filter((m) => !hiddenIds.has(m.id)),
        [messages, hiddenIds],
    );

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
        setSelectedIds(new Set());
    }, [conversationId]);

    // ESC exits selection mode.
    useEffect(() => {
        if (!selectionMode) return;
        const onKey = (e) => {
            if (e.key === 'Escape') setSelectedIds(new Set());
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selectionMode]);

    const startSelection = useCallback((id) => {
        setSelectedIds(new Set([id]));
    }, []);

    const toggleSelected = useCallback((id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const exitSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const handleBulkShare = useCallback(async () => {
        // Preserve message order in the chat, not click order.
        const blocks = messages
            .filter((m) => selectedIds.has(m.id) && !m.deleted_at)
            .map((m) => {
                const lines = [];
                if (m.message) lines.push(m.message);
                if (m.attachment_url) {
                    const label = m.attachment_name || 'Attachment';
                    lines.push(`${label}: ${m.attachment_url}`);
                }
                return lines.join('\n');
            })
            .filter(Boolean);

        const text = blocks.join('\n\n---\n\n');
        if (!text) return;

        if (navigator.share) {
            try {
                await navigator.share({ text });
                exitSelection();
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }

        try {
            await navigator.clipboard.writeText(text);
            toast.success(`Copied ${blocks.length} message${blocks.length === 1 ? '' : 's'}`);
            exitSelection();
        } catch {
            toast.error('Sharing not supported on this device');
        }
    }, [messages, selectedIds, exitSelection]);

    // Bulk delete from the selection toolbar always hides the messages on
    // this side only — never tombstones for everyone, even when every target
    // is one of mine. The per-message ⋯ menu is where "Delete for everyone"
    // lives, because that's a destructive choice we want to confirm one
    // message at a time.
    const handleBulkDelete = useCallback(() => {
        const ids = messages
            .filter((m) => selectedIds.has(m.id) && !m.deleted_at)
            .map((m) => m.id);
        if (ids.length === 0) return;
        setHiddenIds(hideMessages(user.id, ids));
        setSelectedIds(new Set());
        toast.success(`Deleted ${ids.length} for you`);
    }, [messages, selectedIds, user.id]);

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

    const askDelete = useCallback(
        (ids) => {
            // "Delete for everyone" is only offered when every target message
            // is one of mine. Anything else (received messages, or a mix) can
            // only be hidden locally.
            const allMine = ids.every((id) => {
                const m = messagesById.get(id);
                return m && m.sender_id === user.id && !m.deleted_at;
            });
            setDeleteDialog({ open: true, ids, canEveryone: allMine });
        },
        [messagesById, user.id],
    );

    const closeDeleteDialog = useCallback(() => {
        setDeleteDialog((d) => ({ ...d, open: false }));
    }, []);

    const doDeleteForMe = useCallback(() => {
        const ids = deleteDialog.ids;
        closeDeleteDialog();
        if (ids.length === 0) return;
        setHiddenIds(hideMessages(user.id, ids));
        setSelectedIds(new Set());
        toast.success(`Deleted ${ids.length} for you`);
    }, [deleteDialog.ids, closeDeleteDialog, user.id]);

    const doDeleteForEveryone = useCallback(async () => {
        const ids = deleteDialog.ids;
        closeDeleteDialog();
        if (ids.length === 0) return;
        try {
            const results = await Promise.allSettled(ids.map((id) => deleteMessage(id)));
            const updates = new Map();
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') updates.set(ids[i], r.value);
            });
            setMessages((prev) =>
                prev.map((m) => (updates.has(m.id) ? { ...m, ...updates.get(m.id) } : m)),
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed > 0) toast.error(`${failed} message${failed === 1 ? '' : 's'} couldn't be deleted`);
            else toast.success(`Deleted ${ids.length} for everyone`);
            setSelectedIds(new Set());
        } catch (err) {
            toast.error(err.message);
        }
    }, [deleteDialog.ids, closeDeleteDialog]);

    const handleDelete = useCallback((id) => askDelete([id]), [askDelete]);

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
            {/* Header — swaps to a selection toolbar while messages are selected */}
            <header className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 shadow-sm">
                {selectionMode ? (
                    <>
                        <button
                            onClick={exitSelection}
                            className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 -ml-2 text-xl leading-none"
                            aria-label="Cancel selection"
                            title="Cancel"
                        >
                            ×
                        </button>
                        <p className="flex-1 font-semibold text-slate-800 dark:text-slate-100">
                            {selectedIds.size} selected
                        </p>
                        <button
                            onClick={handleBulkShare}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            aria-label="Share selected"
                            title="Share"
                        >
                            <ShareIcon />
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                            aria-label="Delete selected"
                            title={`Delete ${selectedIds.size}`}
                        >
                            <TrashIcon />
                        </button>
                    </>
                ) : (
                    <>
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
                    </>
                )}
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
                ) : visibleMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                        Say hello to {other.username} 👋
                    </div>
                ) : (
                    visibleMessages.map((m) => (
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
                                selectionMode={selectionMode}
                                selected={selectedIds.has(m.id)}
                                onStartSelect={startSelection}
                                onToggleSelect={toggleSelected}
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

            <DeleteDialog
                open={deleteDialog.open}
                count={deleteDialog.ids.length}
                canEveryone={deleteDialog.canEveryone}
                onCancel={closeDeleteDialog}
                onForMe={doDeleteForMe}
                onForEveryone={doDeleteForEveryone}
            />
        </div>
    );
}

/**
 * Delete prompt offering "Delete for me" and (when allowed) "Delete for
 * everyone". Used for both the single-message delete and the bulk delete.
 * Esc cancels.
 */
function DeleteDialog({ open, count, canEveryone, onCancel, onForMe, onForEveryone }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onCancel?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;

    const noun = count === 1 ? 'message' : 'messages';

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 space-y-3"
            >
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Delete {count} {noun}?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    {canEveryone
                        ? "Deleting for everyone removes the message from both sides. Deleting for me hides it only on this device."
                        : "This will only hide the message on your side."}
                </p>
                <div className="flex flex-col gap-2 pt-1">
                    {canEveryone && (
                        <button
                            onClick={onForEveryone}
                            className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition"
                        >
                            Delete for everyone
                        </button>
                    )}
                    <button
                        onClick={onForMe}
                        className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium transition"
                    >
                        Delete for me
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full py-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

function ShareIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
            aria-hidden="true"
        >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
            aria-hidden="true"
        >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
    );
}
