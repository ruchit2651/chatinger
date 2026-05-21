/**
 * Web Push helper. Delivers notifications to a user's subscribed devices
 * through the browser vendor's push service (FCM for Chrome/Edge, Mozilla's
 * autopush for Firefox, Apple's APNs bridge for installed-PWA Safari).
 *
 * If VAPID keys aren't configured, every call becomes a no-op so the rest
 * of the app keeps working in dev without push set up.
 */
const webpush = require('web-push');
const supabase = require('../config/supabase');
const env = require('./../config/env');

let configured = false;
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY,
    );
    configured = true;
} else {
    console.warn('[push] VAPID keys not set — push notifications disabled.');
}

exports.isEnabled = () => configured;

exports.getPublicKey = () => env.VAPID_PUBLIC_KEY;

/**
 * Persist a new subscription. Same (user, endpoint) pair upserts so re-subscribing
 * after a token refresh doesn't create duplicate rows.
 */
exports.saveSubscription = async (userId, subscription) => {
    const { endpoint, keys } = subscription || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error('Invalid push subscription payload');
    }
    const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
            {
                user_id: userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
            },
            { onConflict: 'user_id,endpoint' },
        );
    if (error) throw error;
};

exports.deleteSubscription = async (userId, endpoint) => {
    if (!endpoint) return;
    await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
};

/**
 * Fan out a notification payload to every subscription belonging to a user.
 * Stale endpoints (404 Not Found / 410 Gone) are pruned automatically so the
 * table doesn't fill with dead rows.
 */
exports.sendToUser = async (userId, payload) => {
    if (!configured) return;

    const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId);
    if (error) {
        console.error('[push] failed to load subscriptions:', error.message);
        return;
    }
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(
        subs.map(async (sub) => {
            const subscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
            };
            try {
                await webpush.sendNotification(subscription, body, { TTL: 60 });
            } catch (err) {
                const status = err?.statusCode;
                if (status === 404 || status === 410) {
                    // Subscription is dead — clean it up so we don't retry.
                    await supabase
                        .from('push_subscriptions')
                        .delete()
                        .eq('endpoint', sub.endpoint);
                } else {
                    console.error(`[push] send failed (${status}):`, err.body || err.message);
                }
            }
        }),
    );
};
