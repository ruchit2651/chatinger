import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import {
    listConversations,
    getOrCreateConversation,
    favoriteConversation,
    unfavoriteConversation,
} from '../api/conversations.js';
import { playChime } from '../utils/sound.js';

/**
 * Top-level chat layout: sidebar (conversations + people) and message pane.
 * Owns the conversation list, keeps it in sync with new messages, and tracks
 * which thread is active.
 */
export default function Chat() {
    const { user, logout } = useAuth();
    const { socket } = useSocket();

    const [conversations, setConversations] = useState([]);
    const [activeId, setActiveId]           = useState(null);
    const [sidebarOpen, setSidebarOpen]     = useState(true);
    const [loading, setLoading]             = useState(true);

    const activeConv = conversations.find((c) => c.id === activeId) || null;

    // Initial load — conversations only. Users are now looked up by mobile.
    useEffect(() => {
        (async () => {
            try {
                const convs = await listConversations();
                setConversations(convs);
            } catch (err) {
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Ask the browser for notification permission once per session.
    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, []);

    // Reflect total unread count in the browser tab title, e.g. "(3) Chatinger".
    const baseTitleRef = useRef('Chatinger');
    useEffect(() => {
        const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        document.title = total > 0
            ? `(${total}) ${baseTitleRef.current}`
            : baseTitleRef.current;
    }, [conversations]);

    /**
     * Inbound message handler. We bump the matching conversation's last_message
     * preview, increment unread for *other* conversations, and re-sort.
     */
    useEffect(() => {
        if (!socket) return;

        const onReceive = (msg) => {
            const isInbound = msg.sender_id !== user.id;
            const isActive  = msg.conversation_id === activeId;

            // Chime on every inbound message.
            if (isInbound) playChime();

            // Desktop notification on every inbound message — fires regardless of
            // whether the chat is open and focused, so each one lands in the OS
            // notification area (Windows Action Center / macOS Notification Center).
            if (
                isInbound &&
                'Notification' in window &&
                Notification.permission === 'granted'
            ) {
                try {
                    const sender = msg.sender_username || 'Someone';
                    const title = `Chatinger · ${sender}`;
                    const body = msg.message || (msg.attachment_url ? 'Sent an attachment' : '');
                    // Unique tag per message so notifications stack instead of replacing.
                    const notif = new Notification(title, {
                        body,
                        tag: `message:${msg.id}`,
                        renotify: true,
                        icon: '/favicon.svg',
                        badge: '/favicon.svg',
                    });
                    notif.onclick = () => {
                        window.focus();
                        setActiveId(msg.conversation_id);
                        setSidebarOpen(false);
                        notif.close();
                    };
                } catch {
                    // Some browsers throw if used outside a user gesture; ignore.
                }
            }

            setConversations((prev) => {
                let found = false;
                const next = prev.map((c) => {
                    if (c.id !== msg.conversation_id) return c;
                    found = true;
                    return {
                        ...c,
                        last_message: msg,
                        unread_count:
                            isInbound && !isActive
                                ? (c.unread_count || 0) + 1
                                : c.unread_count,
                    };
                });
                if (!found) {
                    // Conversation was just created on the server — refresh the list.
                    listConversations().then(setConversations).catch(() => {});
                    return prev;
                }
                next.sort((a, b) => {
                    const ta = a.last_message?.created_at || a.created_at;
                    const tb = b.last_message?.created_at || b.created_at;
                    return new Date(tb) - new Date(ta);
                });
                return next;
            });
        };

        const onRead = ({ conversation_id, reader_id }) => {
            // The *other* user read my messages — clear nothing of mine to count,
            // but if it was *me* reading, zero out my unread badge.
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === conversation_id && reader_id === user.id
                        ? { ...c, unread_count: 0 }
                        : c
                )
            );
        };

        // Edited / deleted message — refresh sidebar preview if it was the latest one.
        const onUpdated = (msg) => {
            setConversations((prev) =>
                prev.map((c) => {
                    if (c.id !== msg.conversation_id) return c;
                    if (c.last_message && c.last_message.id === msg.id) {
                        return { ...c, last_message: { ...c.last_message, ...msg } };
                    }
                    return c;
                })
            );
        };

        socket.on('receive_message', onReceive);
        socket.on('messages_read', onRead);
        socket.on('message_updated', onUpdated);
        return () => {
            socket.off('receive_message', onReceive);
            socket.off('messages_read', onRead);
            socket.off('message_updated', onUpdated);
        };
    }, [socket, user.id, activeId]);

    const openChatWithUser = useCallback(async (otherUserId) => {
        try {
            const conv = await getOrCreateConversation(otherUserId);
            setConversations((prev) => {
                if (prev.some((c) => c.id === conv.id)) return prev;
                return [
                    {
                        id: conv.id,
                        created_at: conv.created_at,
                        other_user: conv.other_user,
                        last_message: null,
                        unread_count: 0,
                    },
                    ...prev,
                ];
            });
            setActiveId(conv.id);
            setSidebarOpen(false);
        } catch (err) {
            toast.error(err.message);
        }
    }, []);

    const openConversation = useCallback((id) => {
        setActiveId(id);
        setSidebarOpen(false);
    }, []);

    const toggleFavorite = useCallback(async (id, current) => {
        // Optimistic toggle so the UI doesn't lag the network.
        setConversations((prev) =>
            sortConvos(
                prev.map((c) => (c.id === id ? { ...c, is_favorite: !current } : c))
            )
        );
        try {
            if (current) await unfavoriteConversation(id);
            else         await favoriteConversation(id);
        } catch (err) {
            toast.error(err.message);
            // Revert on failure.
            setConversations((prev) =>
                sortConvos(
                    prev.map((c) => (c.id === id ? { ...c, is_favorite: current } : c))
                )
            );
        }
    }, []);

    return (
        <div className="h-full flex bg-slate-100 dark:bg-slate-900">
            <Sidebar
                me={user}
                conversations={conversations}
                activeId={activeId}
                loading={loading}
                onSelectConversation={openConversation}
                onSelectUser={openChatWithUser}
                onToggleFavorite={toggleFavorite}
                onLogout={logout}
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <main className="flex-1 flex flex-col min-w-0">
                {activeConv ? (
                    <ChatWindow
                        conversation={activeConv}
                        onMessageSent={(msg) => {
                            // Optimistically update our own sidebar preview.
                            setConversations((prev) =>
                                prev.map((c) =>
                                    c.id === msg.conversation_id
                                        ? { ...c, last_message: msg }
                                        : c
                                ).sort((a, b) => {
                                    const ta = a.last_message?.created_at || a.created_at;
                                    const tb = b.last_message?.created_at || b.created_at;
                                    return new Date(tb) - new Date(ta);
                                })
                            );
                        }}
                        onOpenSidebar={() => setSidebarOpen(true)}
                        onReadAll={() => {
                            setConversations((prev) =>
                                prev.map((c) =>
                                    c.id === activeConv.id ? { ...c, unread_count: 0 } : c
                                )
                            );
                        }}
                    />
                ) : (
                    <EmptyState onOpenSidebar={() => setSidebarOpen(true)} />
                )}
            </main>
        </div>
    );
}

// Local sort matching the backend ordering: favorites first, then by activity.
function sortConvos(list) {
    return [...list].sort((a, b) => {
        if ((!!a.is_favorite) !== (!!b.is_favorite)) return a.is_favorite ? -1 : 1;
        const ta = a.last_message?.created_at || a.created_at;
        const tb = b.last_message?.created_at || b.created_at;
        return new Date(tb) - new Date(ta);
    });
}

function EmptyState({ onOpenSidebar }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-500 dark:text-slate-400 dark:bg-slate-900">
            <div className="text-6xl mb-3">💬</div>
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Pick a conversation</h2>
            <p className="text-sm mt-1 max-w-xs">
                Select someone from the sidebar to start chatting in real time.
            </p>
            <button
                onClick={onOpenSidebar}
                className="md:hidden mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm"
            >
                Open chats
            </button>
        </div>
    );
}
