const jwt = require('jsonwebtoken');
const env = require('../config/env');

const TTL = '7d';

exports.signToken = (payload) =>
    jwt.sign(payload, env.JWT_SECRET, { expiresIn: TTL });

exports.verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);
