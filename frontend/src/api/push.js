import api from './axios';

export const getVapidPublicKey = () =>
    api.get('/push/vapid-public-key').then((r) => r.data.key);

export const subscribePush = (subscription) =>
    api.post('/push/subscribe', subscription).then((r) => r.data);

export const unsubscribePush = (endpoint) =>
    api.post('/push/unsubscribe', { endpoint }).then((r) => r.data);
