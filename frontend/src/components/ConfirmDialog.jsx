import { useEffect } from 'react';

/**
 * Lightweight confirmation modal. Renders nothing when `open` is false.
 * Esc cancels, Enter confirms. Clicking the backdrop cancels.
 */
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel,
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onCancel?.();
            else if (e.key === 'Enter') onConfirm?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onCancel, onConfirm]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 space-y-3"
            >
                {title && (
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                        {title}
                    </h3>
                )}
                {message && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {message}
                    </p>
                )}
                <div className="flex gap-2 pt-1">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium transition"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        autoFocus
                        className={`flex-1 py-2 rounded-lg text-white font-medium transition ${
                            danger
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-brand-600 hover:bg-brand-700'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
