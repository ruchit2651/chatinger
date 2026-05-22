/**
 * "Delete for me" persistence. The server stays the source of truth for the
 * conversation; this layer just remembers which message IDs the current user
 * has chosen to hide on their own side. Scoped per-user so multiple accounts
 * on the same browser don't leak hidden state into each other.
 *
 * Storage key: chatinger:hidden:<userId> -> JSON array of message IDs.
 */

const keyFor = (userId) => `chatinger:hidden:${userId}`;

function readAll(userId) {
    if (!userId) return new Set();
    try {
        const raw = localStorage.getItem(keyFor(userId));
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

function writeAll(userId, set) {
    if (!userId) return;
    try {
        localStorage.setItem(keyFor(userId), JSON.stringify([...set]));
    } catch {
        // Storage full / disabled — silently no-op. The hide will just not
        // survive the next reload, which is acceptable for this feature.
    }
}

export function getHidden(userId) {
    return readAll(userId);
}

export function hideMessages(userId, ids) {
    const set = readAll(userId);
    for (const id of ids) set.add(id);
    writeAll(userId, set);
    return set;
}
