const { verifyToken } = require('../utils/jwt');

/**
 * Socket.IO handler.
 *
 * Auth: client must pass a JWT in handshake.auth.token. Invalid tokens get
 * disconnected immediately.
 *
 * Rooms:
 *   user:<userId>           -- private inbox; receives presence + read receipts
 *   conversation:<convoId>  -- joined when a user opens a thread
 *
 * Presence: we maintain an in-memory map of userId -> active socket count.
 * Whenever the count crosses 0/1, we broadcast the new online-user list.
 */
const online = new Map(); // userId -> Set<socketId>

function broadcastOnline(io) {
    io.emit('online_users', Array.from(online.keys()));
}

module.exports = function registerSocket(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Missing token'));
        try {
            const decoded = verifyToken(token);
            socket.userId = decoded.id;
            socket.username = decoded.username;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;

        // Add to presence map.
        if (!online.has(userId)) online.set(userId, new Set());
        online.get(userId).add(socket.id);

        // Private inbox.
        socket.join(`user:${userId}`);

        // Tell everyone (including this socket) who is online.
        broadcastOnline(io);

        // ---- events ----

        socket.on('join', ({ conversation_id }) => {
            if (conversation_id) socket.join(`conversation:${conversation_id}`);
        });

        socket.on('leave', ({ conversation_id }) => {
            if (conversation_id) socket.leave(`conversation:${conversation_id}`);
        });

        socket.on('typing', ({ conversation_id }) => {
            if (!conversation_id) return;
            socket.to(`conversation:${conversation_id}`).emit('typing', {
                conversation_id,
                user_id: userId,
                username: socket.username,
            });
        });

        socket.on('stop_typing', ({ conversation_id }) => {
            if (!conversation_id) return;
            socket.to(`conversation:${conversation_id}`).emit('stop_typing', {
                conversation_id,
                user_id: userId,
            });
        });

        socket.on('disconnect', () => {
            const set = online.get(userId);
            if (set) {
                set.delete(socket.id);
                if (set.size === 0) online.delete(userId);
            }
            broadcastOnline(io);
        });
    });
};
