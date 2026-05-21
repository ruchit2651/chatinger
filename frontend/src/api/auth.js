import api from './axios';

// Register is a two-step flow: request emails an OTP; verify creates the
// user and returns { user, token }.
export const requestRegister = (payload) =>
    api.post('/auth/register/request', payload).then((r) => r.data);
export const verifyRegister  = (payload) =>
    api.post('/auth/register/verify', payload).then((r) => r.data);

// Login is also two-step: request verifies the password and emails an OTP;
// verify returns { user, token }.
export const requestLogin = (payload) =>
    api.post('/auth/login/request', payload).then((r) => r.data);
export const verifyLogin  = (payload) =>
    api.post('/auth/login/verify', payload).then((r) => r.data);

export const me       = ()        => api.get('/auth/me').then((r) => r.data);
export const updateMe = (payload) => api.patch('/auth/me', payload).then((r) => r.data);
