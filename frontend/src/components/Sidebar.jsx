import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext.jsx';
import ProfileModal from './ProfileModal.jsx';
import Avatar from './Avatar.jsx';
import { formatPreviewTime } from '../utils/formatTime.js';
import { searchMessages } from '../api/messages.js';
import { findUserByMobile } from '../api/users.js';

/**
 * Left rail: profile header, conversation search, conversation list, and a
 * "Find by mobile number" panel for starting new chats.
 */
export default function Sidebar({
    me,
    conversations,
    activeId,
    loading,
    onSelectConversation,
    onSelectUser,
    onToggleFavorite,
    onLogout,
    open,
    onClose,
}) {
    const { onlineUsers } = useSocket();
    const [query, setQuery]                 = useState('');
    const [showDirectory, setShowDirectory] = useState(false);
    const [messageHits, setMessageHits]     = useState([]);
    const [searching, setSearching]         = useState(false);
    const [profileOpen, setProfileOpen]     = useState(false);

    const filteredConversations = useMemo(() => {
        if (!query.trim()) return conversations;
        const q = query.toLowerCase();
        return conversations.filter((c) =>
            c.other_user.username.toLowerCase().includes(q)
        );
    }, [conversations, query]);

    // Debounced message-content search across all conversations.
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setMessageHits([]);
            setSearching(false);
            return;
        }
        let cancelled = false;
        setSearching(true);
        const t = setTimeout(() => {
            searchMessages(q)
                .then((hits) => {
                    if (!cancelled) setMessageHits(hits);
                })
                .catch(() => {
                    if (!cancelled) setMessageHits([]);
                })
                .finally(() => {
                    if (!cancelled) setSearching(false);
                });
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [query]);

    return (
        <>
            {open && (
                <div
                    onClick={onClose}
                    className="md:hidden fixed inset-0 bg-black/40 z-30"
                />
            )}

            <aside
                className={`
                    fixed md:static inset-y-0 left-0 z-40 w-80 max-w-[85%] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700
                    flex flex-col transform transition-transform duration-200
                    ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
                `}
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    <button
                        onClick={() => setProfileOpen(true)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg -m-1 p-1 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition"
                        title="View profile"
                    >
                        <Avatar name={me.username} imageUrl={me.avatar_url} online />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{me.username}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{me.email}</p>
                        </div>
                    </button>
                    <button
                        onClick={onLogout}
                        title="Logout"
                        className="text-slate-500 dark:text-slate-300 hover:text-red-500 transition px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        Logout
                    </button>
                </div>

                {/* Search + new chat toggle */}
                <div className="p-3 space-y-2 border-b border-slate-200 dark:border-slate-700">
                    <input
                        type="text"
                        placeholder="Search chats and messages..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        disabled={showDirectory}
                        className="w-full rounded-lg bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                    />
                    <button
                        onClick={() => {
                            setShowDirectory((v) => !v);
                            setQuery('');
                        }}
                        className="w-full text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-700 rounded-lg py-1.5 transition"
                    >
                        {showDirectory ? '← Back to chats' : '+ Start new chat'}
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto chat-scroll">
                    {loading ? (
                        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
                    ) : showDirectory ? (
                        <MobileLookup
                            onlineUsers={onlineUsers}
                            myMobile={me.mobile_number}
                            onPick={(u) => {
                                onSelectUser(u.id);
                                setShowDirectory(false);
                            }}
                        />
                    ) : (
                        <>
                            <ConversationList
                                conversations={filteredConversations}
                                activeId={activeId}
                                onlineUsers={onlineUsers}
                                onPick={(c) => onSelectConversation(c.id)}
                                onToggleFavorite={onToggleFavorite}
                            />
                            {query.trim().length >= 2 && (
                                <MessageHits
                                    query={query.trim()}
                                    hits={messageHits}
                                    searching={searching}
                                    onPick={(hit) => {
                                        onSelectConversation(hit.conversation_id);
                                        setQuery('');
                                    }}
                                />
                            )}
                        </>
                    )}
                </div>
            </aside>

            {profileOpen && (
                <ProfileModal
                    user={me}
                    onClose={() => setProfileOpen(false)}
                    onLogout={onLogout}
                />
            )}
        </>
    );
}

function ConversationList({ conversations, activeId, onlineUsers, onPick, onToggleFavorite }) {
    if (conversations.length === 0) {
        return (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No conversations yet.<br />Tap "Start new chat" above.
            </div>
        );
    }

    return (
        <ul>
            {conversations.map((c) => {
                const isActive = c.id === activeId;
                const isOnline = onlineUsers.includes(c.other_user.id);
                const last     = c.last_message;
                const fav      = !!c.is_favorite;

                return (
                    <li key={c.id} className="relative group/conv">
                        <button
                            onClick={() => onPick(c)}
                            className={`
                                w-full flex items-center gap-3 px-4 py-3 text-left transition
                                ${isActive
                                    ? 'bg-brand-50 dark:bg-slate-700'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'}
                            `}
                        >
                            <Avatar
                                name={c.other_user.username}
                                imageUrl={c.other_user.avatar_url}
                                online={isOnline}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate flex items-center gap-1">
                                        {c.other_user.username}
                                        {fav && (
                                            <span className="text-amber-400 text-xs" title="Favorite">★</span>
                                        )}
                                    </p>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                                        {formatPreviewTime(last?.created_at)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                        {last ? last.message : 'Start the conversation'}
                                    </p>
                                    {c.unread_count > 0 && (
                                        <span className="shrink-0 bg-brand-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                            {c.unread_count}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>

                        {/* Star toggle — visible on hover, always visible when favorited */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite?.(c.id, fav);
                            }}
                            title={fav ? 'Remove from favorites' : 'Add to favorites'}
                            aria-label={fav ? 'Unfavorite' : 'Favorite'}
                            className={`
                                absolute top-1 right-2 w-7 h-7 rounded-full flex items-center justify-center text-base
                                transition
                                ${fav
                                    ? 'text-amber-400 opacity-100'
                                    : 'text-slate-400 dark:text-slate-500 opacity-0 group-hover/conv:opacity-100 hover:text-amber-400'}
                            `}
                        >
                            {fav ? '★' : '☆'}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

function MessageHits({ query, hits, searching, onPick }) {
    return (
        <div className="border-t border-slate-200 dark:border-slate-700 mt-1 pt-2">
            <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Messages
            </div>
            {searching ? (
                <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">Searching...</div>
            ) : hits.length === 0 ? (
                <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">No matches</div>
            ) : (
                <ul>
                    {hits.map((h) => (
                        <li key={h.id}>
                            <button
                                onClick={() => onPick(h)}
                                className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                        {h.other_user?.username || 'Unknown'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                                        {formatPreviewTime(h.created_at)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    <HighlightedText text={h.message} query={query} />
                                </p>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function HighlightedText({ text, query }) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded px-0.5">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    );
}

/**
 * Find-by-mobile panel. Users no longer browse a global directory — they
 * type a phone number, we look it up, and surface the matching user.
 */
function MobileLookup({ onPick, onlineUsers, myMobile }) {
    const [number, setNumber]     = useState('');
    const [result, setResult]     = useState(null);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);

    const submit = async (e) => {
        e?.preventDefault?.();
        const digits = number.replace(/\D/g, '');
        if (digits.length < 6) {
            toast.error('Enter at least 6 digits');
            return;
        }
        if (myMobile && myMobile.replace(/\D/g, '') === digits) {
            toast.error("That's your own number");
            return;
        }
        setSearching(true);
        try {
            const user = await findUserByMobile(number.trim());
            setResult(user);
            setSearched(true);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="p-3 space-y-3">
            <form onSubmit={submit} className="space-y-2">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Find user by mobile number
                </label>
                <div className="flex gap-2">
                    <input
                        type="tel"
                        inputMode="tel"
                        autoFocus
                        placeholder="+1 555 123 4567"
                        value={number}
                        onChange={(e) => {
                            setNumber(e.target.value);
                            setSearched(false);
                            setResult(null);
                        }}
                        className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                        type="submit"
                        disabled={searching || number.trim().length === 0}
                        className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm px-3 rounded-lg"
                    >
                        {searching ? '…' : 'Find'}
                    </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Spaces, dashes, and parentheses are ignored. Use the
                    international form (with <span className="font-mono">+</span>) if available.
                </p>
            </form>

            {result && (
                <button
                    onClick={() => onPick(result)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-left transition"
                >
                    <Avatar
                        name={result.username}
                        imageUrl={result.avatar_url}
                        online={onlineUsers.includes(result.id)}
                    />
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                            {result.username}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {result.mobile_number}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            {result.email}
                        </p>
                    </div>
                    <span className="text-xs text-brand-600 dark:text-brand-400 shrink-0">Chat →</span>
                </button>
            )}

            {searched && !result && !searching && (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-4">
                    No user with that number.
                </p>
            )}
        </div>
    );
}

