/**
 * Backend entry point — boots Express + Socket.IO on the same HTTP server.
 */
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const env = require('./src/config/env');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const conversationRoutes = require('./src/routes/conversationRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const reactionRoutes = require('./src/routes/reactionRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const registerSocket = require('./src/socket/socketHandler');

const app = express();

// Accept any origin in the allowlist (single URL or comma-separated list
// via CLIENT_URL). Requests with no Origin header (curl, healthchecks) pass
// through too — they aren't browsers.
const corsOptions = {
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (env.CLIENT_URLS.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/uploads', uploadRoutes);

app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: env.CLIENT_URLS, credentials: true },
});

registerSocket(io);
app.set('io', io);

server.listen(env.PORT, () => {
    console.log(`[server] listening on :${env.PORT}`);
});
