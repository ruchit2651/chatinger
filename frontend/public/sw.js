/* Chatinger service worker — handles incoming push notifications and clicks. */

self.addEventListener('install', (event) => {
    // Activate immediately on first install rather than waiting for the next reload.
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'Chatinger', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'Chatinger';
    const options = {
        body: data.body || 'You have a new message',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: data.message_id ? `message:${data.message_id}` : 'chatinger',
        renotify: true,
        data: {
            conversation_id: data.conversation_id || null,
            url: '/',
        },
    };

    event.waitUntil(
        (async () => {
            // Suppress notifications when the user is already looking at the
            // app — the in-page socket handler will play the chime + bump the
            // unread count, which is plenty.
            const clients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });
            const focused = clients.some((c) => c.focused);
            if (focused) return;

            await self.registration.showNotification(title, options);
        })(),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        (async () => {
            const all = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });

            // If a Chatinger tab is already open, focus it and tell the page
            // which conversation to open. Otherwise spin up a new tab.
            for (const client of all) {
                if ('focus' in client) {
                    client.postMessage({
                        type: 'push:open-conversation',
                        conversation_id: event.notification.data?.conversation_id || null,
                    });
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })(),
    );
});
