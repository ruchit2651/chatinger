const push = require('../utils/push');

/** GET /api/push/vapid-public-key — public VAPID key for the browser to subscribe. */
exports.getPublicKey = (_req, res) => {
    const key = push.getPublicKey();
    if (!key) return res.status(503).json({ error: 'Push is not configured' });
    res.json({ key });
};

/** POST /api/push/subscribe — body: PushSubscription JSON. */
exports.subscribe = async (req, res, next) => {
    try {
        if (!push.isEnabled()) {
            return res.status(503).json({ error: 'Push is not configured' });
        }
        await push.saveSubscription(req.user.id, req.body || {});
        res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
};

/** POST /api/push/unsubscribe — body: { endpoint }. */
exports.unsubscribe = async (req, res, next) => {
    try {
        await push.deleteSubscription(req.user.id, req.body?.endpoint);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
