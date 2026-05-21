import { useEffect, useRef, useState } from 'react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext.jsx';
import { uploadAttachment } from '../api/attachments.js';

const STOP_TYPING_DELAY = 1500;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Composer at the bottom of the chat. Supports text, emoji, file attachments,
 * and a "replying to" banner. Owns its own draft state.
 */
export default function MessageInput({
    onSend,
    onTyping,
    onStopTyping,
    disabled,
    replyTo,
    onCancelReply,
}) {
    const { theme } = useTheme();
    const [text, setText]               = useState('');
    const [sending, setSending]         = useState(false);
    const [pickerOpen, setPickerOpen]   = useState(false);
    const [attachment, setAttachment]   = useState(null); // { url, type, name } after upload
    const [uploading, setUploading]     = useState(false);
    const typingRef = useRef(false);
    const stopTimerRef = useRef(null);
    const pickerWrapRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => () => {
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        if (typingRef.current) onStopTyping?.();
    }, [onStopTyping]);

    useEffect(() => {
        if (!pickerOpen) return;
        const onDocClick = (e) => {
            if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [pickerOpen]);

    const handleEmoji = (emojiData) => {
        setText((t) => t + emojiData.emoji);
        inputRef.current?.focus();
    };

    const handleChange = (e) => {
        const v = e.target.value;
        setText(v);

        if (v.length > 0) {
            if (!typingRef.current) {
                typingRef.current = true;
                onTyping?.();
            }
            if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
            stopTimerRef.current = setTimeout(() => {
                typingRef.current = false;
                onStopTyping?.();
            }, STOP_TYPING_DELAY);
        } else if (typingRef.current) {
            typingRef.current = false;
            onStopTyping?.();
        }
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > MAX_ATTACHMENT_BYTES) {
            toast.error('File too large (max 8 MB)');
            return;
        }
        setUploading(true);
        try {
            const meta = await uploadAttachment(file);
            setAttachment(meta);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed && !attachment) return;
        if (sending || uploading) return;

        setSending(true);
        try {
            await onSend(trimmed, attachment ? {
                attachment_url: attachment.url,
                attachment_type: attachment.type,
                attachment_name: attachment.name,
            } : {});
            setText('');
            setAttachment(null);
            if (typingRef.current) {
                typingRef.current = false;
                onStopTyping?.();
            }
        } finally {
            setSending(false);
        }
    };

    const canSend = !disabled && !sending && !uploading && (text.trim() || attachment);

    return (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {replyTo && (
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 flex items-start gap-2">
                    <div className="w-1 self-stretch bg-brand-500 rounded-full" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-brand-600 dark:text-brand-400">
                            Replying to
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                            {replyTo.deleted_at
                                ? 'deleted message'
                                : (replyTo.message || replyTo.attachment_name || 'attachment')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancelReply}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none"
                        aria-label="Cancel reply"
                    >
                        ×
                    </button>
                </div>
            )}

            {attachment && (
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 flex items-center gap-2">
                    {attachment.type?.startsWith('image/') ? (
                        <img src={attachment.url} alt={attachment.name} className="h-12 w-12 object-cover rounded" />
                    ) : (
                        <span className="text-xl">📎</span>
                    )}
                    <span className="flex-1 text-xs text-slate-700 dark:text-slate-200 truncate">{attachment.name}</span>
                    <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none"
                        aria-label="Remove attachment"
                    >
                        ×
                    </button>
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="px-2 sm:px-3 py-3 flex items-center gap-1 sm:gap-2 relative"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
                <div className="relative" ref={pickerWrapRef}>
                    <button
                        type="button"
                        onClick={() => setPickerOpen((v) => !v)}
                        disabled={disabled || sending}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50 shrink-0"
                        aria-label="Pick emoji"
                        title="Pick emoji"
                    >
                        😊
                    </button>
                    {pickerOpen && (
                        <div className="fixed sm:absolute bottom-20 sm:bottom-12 left-2 right-2 sm:left-0 sm:right-auto z-30 flex justify-center sm:block">
                            <EmojiPicker
                                onEmojiClick={handleEmoji}
                                theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                                emojiStyle={EmojiStyle.NATIVE}
                                height={Math.min(380, Math.floor(window.innerHeight * 0.5))}
                                width={Math.min(320, window.innerWidth - 24)}
                                previewConfig={{ showPreview: false }}
                                lazyLoadEmojis
                            />
                        </div>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFile}
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || sending || uploading}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50 shrink-0"
                    aria-label="Attach file"
                    title="Attach file"
                >
                    {uploading ? '…' : '📎'}
                </button>

                <input
                    ref={inputRef}
                    type="text"
                    placeholder={uploading ? 'Uploading...' : 'Type a message...'}
                    value={text}
                    onChange={handleChange}
                    disabled={disabled || sending}
                    className="flex-1 min-w-0 rounded-full bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 px-3 sm:px-4 py-2 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                />
                <button
                    type="submit"
                    disabled={!canSend}
                    className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-full w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center transition shrink-0"
                    aria-label="Send"
                >
                    {sending ? '...' : '→'}
                </button>
            </form>
        </div>
    );
}
