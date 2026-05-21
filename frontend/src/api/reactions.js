import api from './axios';

export const addReaction = (message_id, emoji) =>
    api.post('/reactions', { message_id, emoji }).then((r) => r.data.reaction);

export const removeReaction = (message_id, emoji) =>
    api.delete('/reactions', { data: { message_id, emoji } }).then((r) => r.data);
