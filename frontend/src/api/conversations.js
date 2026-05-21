import api from './axios';

export const listConversations = () =>
    api.get('/conversations').then((r) => r.data.conversations);

export const getOrCreateConversation = (other_user_id) =>
    api.post('/conversations', { other_user_id }).then((r) => r.data.conversation);

export const favoriteConversation = (id) =>
    api.put(`/conversations/${id}/favorite`).then((r) => r.data);

export const unfavoriteConversation = (id) =>
    api.delete(`/conversations/${id}/favorite`).then((r) => r.data);
