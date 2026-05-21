import api from './axios';

export const getHistory = (conversationId) =>
    api.get(`/messages/${conversationId}`).then((r) => r.data.messages);

export const sendMessage = (conversation_id, message, extra = {}) =>
    api.post('/messages', { conversation_id, message, ...extra }).then((r) => r.data.message);

export const editMessage = (id, message) =>
    api.patch(`/messages/${id}`, { message }).then((r) => r.data.message);

export const deleteMessage = (id) =>
    api.delete(`/messages/${id}`).then((r) => r.data.message);

export const markRead = (conversationId) =>
    api.patch(`/messages/${conversationId}/read`).then((r) => r.data);

export const searchMessages = (q) =>
    api.get('/messages/search/all', { params: { q } }).then((r) => r.data.results);
