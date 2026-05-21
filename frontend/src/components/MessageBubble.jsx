import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../utils/formatTime.js';
import { downloadFile } from '../utils/download.js';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/**
 * Chat bubble: text, attachments, edited / deleted state, reply quote,
 * reactions, and a hover menu (edit / delete / reply / react).
 *
 * Most of the heavy lifting (API calls, optimistic updates) is done by the
 * parent ChatWindow; this component is mostly presentational with local
 * state for "editing" and the action menus.
 */
export default function MessageBubble({
    message,
    mine,
    myUserId,
    repliedMessage,
    onEdit,
    onDelete,
    onReply,
    onReact,
    onJumpTo,
}) {
    const [menuOpen, setMenuOpen]     = useState(false);
    const [editing, setEditing]       = useState(false);
    const [draft, setDraft]           = useState(message.message);
    const [reactBarOpen, setReactBar] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen && !reactBarOpen) return;
        const close = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
                setReactBar(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [menuOpen, reactBarOpen]);

    const isDeleted = !!message.deleted_at;
    const isEdited  = !!message.edited_at && !isDeleted;

    const startEdit = () => {
        setDraft(message.message);
        setEditing(true);
        setMenuOpen(false);
    };

    const commitEdit = async () => {
        const next = draft.trim();
        if (!next || next === message.message) {
            setEditing(false);
            return;
        }
        try {
            await onEdit?.(message.id, next);
        } finally {
            setEditing(false);
        }
    };

    const handleReact = async (emoji) => {
        setReactBar(false);
        setMenuOpen(false);
        await onReact?.(message.id, emoji);
    };

    // Aggregate reactions by emoji for display.
    const reactionGroups = (message.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, mine: false, userIds: [] };
        acc[r.emoji].count += 1;
        acc[r.emoji].userIds.push(r.user_id);
        if (r.user_id === myUserId) acc[r.emoji].mine = true;
        return acc;
    }, {});
    const reactionList = Object.values(reactionGroups);

    const handleContextMenu = (e) => {
        // Right-click on a message = quick reply. Skip on deleted messages
        // and while inline-editing so users can still right-click the textarea.
        if (isDeleted || editing) return;
        e.preventDefault();
        onReply?.(message);
    };

    return (
        <div
            className={`group flex ${mine ? 'justify-end' : 'justify-start'} px-1`}
            onContextMenu={handleContextMenu}
        >
            <div className="relative max-w-[78%] md:max-w-[60%]">
                {/* Hover menu — sits above the bubble */}
                {!isDeleted && !editing && (
                    <div
                        ref={menuRef}
                        className={`absolute -top-3 ${mine ? 'right-1' : 'left-1'} opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition flex items-center gap-1 z-10`}
                    >
                        <button
                            onClick={() => setReactBar((v) => !v)}
                            className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600"
                            title="React"
                            aria-label="React"
                        >
                            😊
                        </button>
                        <button
                            onClick={() => onReply?.(message)}
                            className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600"
                            title="Reply"
                            aria-label="Reply"
                        >
                            ↩
                        </button>
                        {mine && (
                            <button
                                onClick={() => setMenuOpen((v) => !v)}
                                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full w-7 h-7 text-xs flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600"
                                title="More"
                                aria-label="More"
                            >
                                ⋯
                            </button>
                        )}

                        {reactBarOpen && (
                            <div className={`absolute top-8 ${mine ? 'right-0' : 'left-0'} bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full px-2 py-1 shadow-md flex items-center gap-1`}>
                                {QUICK_REACTIONS.map((e) => (
                                    <button
                                        key={e}
                                        onClick={() => handleReact(e)}
                                        className="text-lg hover:scale-125 transition"
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        )}

                        {menuOpen && mine && (
                            <div className={`absolute top-8 ${mine ? 'right-0' : 'left-0'} bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-md text-sm overflow-hidden`}>
                                <button
                                    onClick={startEdit}
                                    className="block w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 whitespace-nowrap"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onDelete?.(message.id);
                                    }}
                                    className="block w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-600 text-red-600 dark:text-red-400 whitespace-nowrap"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div
                    className={`
                        rounded-2xl px-4 py-2 shadow-sm
                        ${mine
                            ? 'bg-brand-600 text-white rounded-br-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'}
                        ${isDeleted ? 'italic opacity-70' : ''}
                    `}
                >
                    {/* Reply quote */}
                    {repliedMessage && !isDeleted && (
                        <button
                            onClick={() => onJumpTo?.(repliedMessage.id)}
                            className={`
                                block w-full text-left text-xs mb-1 px-2 py-1 rounded
                                border-l-2 truncate
                                ${mine
                                    ? 'bg-brand-700/40 border-white/60 text-brand-50'
                                    : 'bg-slate-100 dark:bg-slate-700 border-brand-500 text-slate-600 dark:text-slate-300'}
                            `}
                        >
                            <span className="font-medium">
                                {repliedMessage.sender_id === myUserId ? 'You' : 'Reply'}
                            </span>
                            <span className="mx-1">·</span>
                            <span className="truncate">
                                {repliedMessage.deleted_at
                                    ? 'deleted message'
                                    : (repliedMessage.message || repliedMessage.attachment_name || 'attachment')}
                            </span>
                        </button>
                    )}

                    {/* Attachment */}
                    {!isDeleted && message.attachment_url && (
                        <Attachment message={message} mine={mine} />
                    )}

                    {/* Text */}
                    {editing ? (
                        <div className="flex flex-col gap-1">
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                rows={Math.min(5, Math.max(1, draft.split('\n').length))}
                                className="w-full text-sm rounded px-2 py-1 text-slate-800 bg-white border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        commitEdit();
                                    } else if (e.key === 'Escape') {
                                        setEditing(false);
                                    }
                                }}
                            />
                            <div className="flex gap-2 text-[11px]">
                                <button
                                    onClick={commitEdit}
                                    className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap break-words text-sm leading-snug">
                            {isDeleted ? 'This message was deleted' : message.message}
                        </p>
                    )}

                    {/* Footer: time + edited + read state */}
                    <div
                        className={`
                            mt-1 flex items-center gap-1 text-[11px]
                            ${mine ? 'text-brand-100 justify-end' : 'text-slate-400 dark:text-slate-500'}
                        `}
                    >
                        {isEdited && <span title={`Edited ${formatTime(message.edited_at)}`}>edited ·</span>}
                        <span>{formatTime(message.created_at)}</span>
                        {mine && !isDeleted && (
                            <span>{message.is_read ? '· Seen' : '· Sent'}</span>
                        )}
                    </div>
                </div>

                {/* Reactions row */}
                {!isDeleted && reactionList.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {reactionList.map((r) => (
                            <button
                                key={r.emoji}
                                onClick={() => handleReact(r.emoji)}
                                title={r.mine ? 'Click to remove your reaction' : 'Click to react'}
                                className={`
                                    text-xs rounded-full px-2 py-0.5 border transition
                                    ${r.mine
                                        ? 'bg-brand-100 dark:bg-brand-900/40 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-200'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}
                                `}
                            >
                                <span>{r.emoji}</span>
                                <span className="ml-1 font-medium">{r.count}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function Attachment({ message, mine }) {
    const url = message.attachment_url;
    const type = message.attachment_type || '';
    const name = message.attachment_name || 'download';
    const isImage = type.startsWith('image/');

    const handleDownload = (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadFile(url, name);
    };

    if (isImage) {
        return (
            <div className="relative group/att mb-1">
                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                        src={url}
                        alt={name}
                        className="max-h-48 sm:max-h-60 md:max-h-72 max-w-full w-auto rounded-lg"
                    />
                </a>
                <button
                    type="button"
                    onClick={handleDownload}
                    title="Download"
                    aria-label="Download image"
                    className="absolute top-2 right-2 bg-black/55 hover:bg-black/75 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm opacity-0 group-hover/att:opacity-100 focus:opacity-100 transition"
                >
                    ⬇
                </button>
            </div>
        );
    }
    return (
        <div
            className={`
                flex items-center gap-2 px-2 py-1.5 mb-1 rounded text-xs
                ${mine ? 'bg-brand-700/40 text-brand-50' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}
            `}
        >
            <span>📎</span>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate hover:underline"
            >
                {name}
            </a>
            <button
                type="button"
                onClick={handleDownload}
                title="Download"
                aria-label="Download file"
                className={`
                    px-1.5 py-0.5 rounded text-sm shrink-0
                    ${mine ? 'hover:bg-brand-800/60' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}
                `}
            >
                ⬇
            </button>
        </div>
    );
}
