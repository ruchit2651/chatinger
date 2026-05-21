import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Avatar from './Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { updateMe } from '../api/auth.js';
import { uploadAttachment } from '../api/attachments.js';

const MAX_CAPTION_LEN  = 200;
const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Profile modal for the signed-in user. View / edit mode for username,
 * birth date, mobile, caption, and profile photo.
 */
export default function ProfileModal({ user, onClose, onLogout }) {
    const { setUser } = useAuth();
    const [editing, setEditing]   = useState(false);
    const [saving, setSaving]     = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const [form, setForm] = useState(() => initialForm(user));

    // Reset form when the modal opens or we toggle edit mode.
    useEffect(() => {
        setForm(initialForm(user));
    }, [user, editing]);

    // Esc closes the modal (cancel edit first).
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (editing) setEditing(false);
            else onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, editing]);

    if (!user) return null;

    const joined = user.created_at
        ? new Date(user.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : '—';

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handlePickAvatar = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Pick an image file');
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            toast.error('Image too large (max 4 MB)');
            return;
        }
        setUploading(true);
        try {
            const meta = await uploadAttachment(file);
            // Save to the user record immediately so the new DP propagates
            // everywhere (sidebar header, chat lists, etc.) without an extra
            // explicit "Save" click for the photo.
            const { user: updated } = await updateMe({ avatar_url: meta.url });
            setUser(updated);
            toast.success('Photo updated');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user.avatar_url) return;
        setUploading(true);
        try {
            const { user: updated } = await updateMe({ avatar_url: '' });
            setUser(updated);
            toast.success('Photo removed');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        const payload = {};
        if (form.username.trim() !== (user.username || '')) {
            payload.username = form.username.trim();
        }
        if ((form.birth_date || '') !== (user.birth_date || '')) {
            payload.birth_date = form.birth_date || '';
        }
        if (form.mobile_number.trim() !== (user.mobile_number || '')) {
            payload.mobile_number = form.mobile_number.trim();
        }
        if (form.caption !== (user.caption || '')) {
            payload.caption = form.caption;
        }

        if (Object.keys(payload).length === 0) {
            setEditing(false);
            return;
        }

        setSaving(true);
        try {
            const { user: updated } = await updateMe(payload);
            setUser(updated);
            toast.success('Profile updated');
            setEditing(false);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90dvh]"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 text-lg leading-none flex items-center justify-center z-10"
                >
                    ×
                </button>

                <div className="flex-1 overflow-y-auto chat-scroll">

                {/* Avatar */}
                <div className="pt-8 flex justify-center">
                    <div className="relative">
                        <Avatar
                            name={user.username}
                            imageUrl={user.avatar_url}
                            sizeClass="w-24 h-24"
                            textClass="font-bold text-3xl"
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePickAvatar}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            title="Change profile photo"
                            aria-label="Change profile photo"
                            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center shadow ring-2 ring-white dark:ring-slate-800 disabled:opacity-60"
                        >
                            {uploading ? '…' : '📷'}
                        </button>
                    </div>
                </div>
                {user.avatar_url && !uploading && (
                    <div className="text-center mt-1">
                        <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                        >
                            Remove photo
                        </button>
                    </div>
                )}

                <div className="px-6 pb-6 pt-3 text-center">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                        {user.username}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 break-all">
                        {user.email}
                    </p>
                    {user.caption && !editing && (
                        <p className="mt-2 text-sm italic text-slate-600 dark:text-slate-300 break-words">
                            “{user.caption}”
                        </p>
                    )}

                    <div className="mt-5 space-y-3 text-left">
                        {editing ? (
                            <>
                                <EditField
                                    label="Username"
                                    name="username"
                                    value={form.username}
                                    onChange={onChange}
                                    placeholder="username"
                                />
                                <ReadOnlyField label="Email" value={user.email} />
                                <EditField
                                    label="Birth date"
                                    name="birth_date"
                                    type="date"
                                    value={form.birth_date || ''}
                                    onChange={onChange}
                                />
                                <EditField
                                    label="Mobile number"
                                    name="mobile_number"
                                    type="tel"
                                    value={form.mobile_number}
                                    onChange={onChange}
                                    placeholder="+1 555 123 4567"
                                    hint="6-20 digits. Country code with + allowed."
                                />
                                <EditTextarea
                                    label="Caption"
                                    name="caption"
                                    value={form.caption}
                                    onChange={onChange}
                                    placeholder="Say something about yourself..."
                                    maxLength={MAX_CAPTION_LEN}
                                />
                            </>
                        ) : (
                            <>
                                <ReadOnlyField label="Username"      value={user.username} />
                                <ReadOnlyField label="Email"         value={user.email} />
                                <ReadOnlyField label="Birth date"    value={formatDate(user.birth_date)} />
                                <ReadOnlyField label="Mobile number" value={user.mobile_number || '—'} />
                                <ReadOnlyField label="Caption"       value={user.caption || '—'} />
                                <ReadOnlyField label="Joined"        value={joined} />
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    {editing ? (
                        <div className="mt-5 flex gap-2">
                            <button
                                onClick={() => setEditing(false)}
                                disabled={saving}
                                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium transition disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition disabled:opacity-60"
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    ) : (
                        <div className="mt-5 flex gap-2">
                            <button
                                onClick={() => setEditing(true)}
                                className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition"
                            >
                                Edit profile
                            </button>
                            {onLogout && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        onLogout();
                                    }}
                                    className="flex-1 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 font-medium transition"
                                >
                                    Logout
                                </button>
                            )}
                        </div>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
}

function initialForm(u) {
    return {
        username:      u?.username || '',
        birth_date:    u?.birth_date || '',
        mobile_number: u?.mobile_number || '',
        caption:       u?.caption || '',
    };
}

function ReadOnlyField({ label, value }) {
    return (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                {label}
            </p>
            <p className="text-sm text-slate-800 dark:text-slate-100 break-words">
                {value || '—'}
            </p>
        </div>
    );
}

function EditField({ label, name, value, onChange, type = 'text', placeholder, hint }) {
    return (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2">
            <label
                htmlFor={name}
                className="block text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400"
            >
                {label}
            </label>
            <input
                id={name}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:outline-none text-sm text-slate-800 dark:text-slate-100 px-0 py-1 placeholder-slate-400"
            />
            {hint && (
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    {hint}
                </p>
            )}
        </div>
    );
}

function EditTextarea({ label, name, value, onChange, placeholder, maxLength }) {
    return (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2">
            <div className="flex items-center justify-between">
                <label
                    htmlFor={name}
                    className="block text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400"
                >
                    {label}
                </label>
                {maxLength && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {value.length}/{maxLength}
                    </span>
                )}
            </div>
            <textarea
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={2}
                maxLength={maxLength}
                className="w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:outline-none text-sm text-slate-800 dark:text-slate-100 px-0 py-1 placeholder-slate-400 resize-none"
            />
        </div>
    );
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch {
        return iso;
    }
}
