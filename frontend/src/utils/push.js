/**
 * Register the service worker, ask for notification permission, and subscribe
 * the browser to the Web Push channel. The resulting subscription is POSTed
 * to the backend so future messages can be pushed to this device — even when
 * the tab is closed.
 *
 * Safe to call multiple times. Logs every step under `[push]` so a stuck flow
 * can be diagnosed from DevTools without source-diving.
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

function keysMatch(a, b) {
    if (!a || !b) return false;
    const aa = new Uint8Array(a);
    const bb = new Uint8Array(b);
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
    return true;
}

export async function registerAndSubscribe() {
    if (!isSupported()) {
        const reason = 'browser does not support service workers or Web Push';
        console.warn('[push]', reason);
        throw new Error(reason);
    }

    console.info('[push] registering service worker at', SW_URL);
    let reg;
    try {
        reg = await navigator.serviceWorker.register(SW_URL);
    } catch (err) {
        console.error('[push] service worker registration failed:', err);
        throw new Error(`Service worker registration failed: ${err.message}`);
    }

    if (!reg.active) {
        console.info('[push] waiting for service worker to activate');
        await new Promise((resolve) => {
            const worker = reg.installing || reg.waiting;
            if (!worker) return resolve();
            worker.addEventListener('statechange', () => {
                if (worker.state === 'activated') resolve();
            });
        });
    }
    console.info('[push] service worker is active');

    if (Notification.permission === 'default') {
        console.info('[push] requesting notification permission');
        const result = await Notification.requestPermission();
        console.info('[push] permission result:', result);
        if (result !== 'granted') {
            throw new Error('Notification permission was not granted');
        }
    }
    if (Notification.permission !== 'granted') {
        throw new Error(
            'Notifications are blocked for this site. Click the lock icon next to the URL, open Site settings, set Notifications to Allow, then reload.',
        );
    }

    let publicKey;
    try {
        publicKey = await getVapidPublicKey();
    } catch (err) {
        console.error('[push] could not fetch VAPID public key:', err);
        throw new Error(`Backend VAPID key fetch failed: ${err.message}`);
    }
    if (!publicKey) {
        throw new Error('Backend has no VAPID public key configured');
    }

    const currentKey = urlBase64ToUint8Array(publicKey);

    let sub = await reg.pushManager.getSubscription();
    if (sub) {
        const existingKey = sub.options?.applicationServerKey;
        if (existingKey && !keysMatch(existingKey, currentKey)) {
            console.info('[push] existing subscription uses old VAPID key — refreshing');
            await sub.unsubscribe();
            sub = null;
        }
    }
    if (!sub) {
        console.info('[push] creating push subscription');
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: currentKey,
        });
    }

    console.info('[push] sending subscription to backend');
    try {
        await subscribePush(sub.toJSON());
    } catch (err) {
        console.error('[push] backend rejected subscription:', err);
        throw new Error(`Backend rejected subscription: ${err.message}`);
    }
    console.info('[push] ready');
    return sub;
}

export function notificationPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
}
