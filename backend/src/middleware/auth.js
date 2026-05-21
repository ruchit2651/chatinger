const { verifyToken } = require('../utils/jwt');

module.exports = function authMiddleware(req, _res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        const err = new Error('Missing auth token');
        err.status = 401;
        return next(err);
    }

    try {
        const decoded = verifyToken(token);
        req.user = { id: decoded.id, username: decoded.username, email: decoded.email };
        next();
    } catch {
        const err = new Error('Invalid or expired token');
        err.status = 401;
        next(err);
    }
};
