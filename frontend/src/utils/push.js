/**
 * Register the service worker, ask for notification permission, and subscribe
 * the browser to the Web Push channel. The resulting subscription is POSTed
 * to the backend so future messages can be pushed to this device — even when
 * the tab is closed.
 *
 * Safe to call multiple times: the SW registration and PushManager.subscribe
 * are idempotent. Throws softly (logs + returns) when push isn't supported.
 */
import { getVapidPublicKey, subscribePush } from '../api/push.js';

const SW_URL = '/sw.js';

const isSupported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

export async function registerAndSubscribe() {
    if (!isSupported()) {
        console.info('[push] not supported in this browser');
        return null;
    }

    const reg = await navigator.serviceWorker.register(SW_URL);
    // Wait for the SW to be active before subscribing — Safari especially
    // throws if you call subscribe() against an installing/waiting worker.
    if (!reg.active) {
        await new Promise((resolve) => {
            const worker = reg.installing || reg.waiting;
            if (!worker) return resolve();
            worker.addEventListener('statechange', () => {
                if (worker.state === 'activated') resolve();
            });
        });
    }

    if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') return null;
    }
    if (Notification.permission !== 'granted') return null;

    let publicKey;
    try {
        publicKey = await getVapidPublicKey();
    } catch (err) {
        console.warn('[push] could not fetch VAPID public key:', err.message);
        return null;
    }
    if (!publicKey) return null;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
    }

    try {
        await subscribePush(sub.toJSON());
    } catch (err) {
        console.warn('[push] backend rejected subscription:', err.message);
    }
    return sub;
}
