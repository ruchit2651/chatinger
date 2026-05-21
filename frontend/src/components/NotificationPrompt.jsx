import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { registerAndSubscribe, notificationPermission } from '../utils/push.js';

/**
 * Slim banner that prompts the user to enable browser notifications. Sits at
 * the top of the chat layout and disappears once permission is granted.
 *
 * Why a click-to-enable button instead of an automatic prompt: some browsers
 * silently ignore permission requests outside a user gesture, and a denied
 * site permission can't be undone in code — the user must reset it from the
 * browser's site-settings panel. The banner makes both flows explicit.
 */
export default function NotificationPrompt() {
    const [permission, setPermission] = useState(notificationPermission());
    const [enabling, setEnabling]     = useState(false);

    // Notification.permission doesn't fire an event when the user changes site
    // settings, so we poll on a slow interval to catch external resets.
    useEffect(() => {
        const id = setInterval(() => {
            const next = notificationPermission();
            setPermission((prev) => (prev === next ? prev : next));
        }, 3000);
        return () => clearInterval(id);
    }, []);

    if (permission === 'granted' || permission === 'unsupported') return null;

    const onEnable = async () => {
        setEnabling(true);
        try {
            await registerAndSubscribe();
            setPermission(notificationPermission());
            toast.success('Notifications are on');
        } catch (err) {
            setPermission(notificationPermission());
            toast.error(err.message);
        } finally {
            setEnabling(false);
        }
    };

    const blocked = permission === 'denied';

    return (
        <div className="bg-brand-50 dark:bg-slate-800 border-b border-brand-200 dark:border-slate-700 px-4 py-2.5 flex flex-wrap items-center gap-3">
            <span className="text-xl leading-none">🔔</span>
            <div className="flex-1 min-w-0 text-sm">
                {blocked ? (
                    <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">Notifications are blocked.</span>{' '}
                        Click the lock icon next to the URL → <em>Site settings</em> →
                        set <em>Notifications</em> to <em>Allow</em>, then reload.
                    </p>
                ) : (
                    <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">Get notified for every message.</span>{' '}
                        Allow notifications so Chatinger can ping you when a friend writes — even when the tab is closed.
                    </p>
                )}
            </div>
            {!blocked && (
                <button
                    onClick={onEnable}
                    disabled={enabling}
                    className="shrink-0 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition"
                >
                    {enabling ? 'Enabling…' : 'Enable notifications'}
                </button>
            )}
        </div>
    );
}
