import api from './axios';

/**
 * Look up a single user by mobile number (the backend normalizes formatting).
 * Resolves to the user or null when not found.
 */
export const findUserByMobile = (mobile) =>
    api
        .get('/users/find', { params: { mobile } })
        .then((r) => r.data.user)
        .catch((err) => {
            if (err.message === 'No user with that mobile number') return null;
            throw err;
        });
