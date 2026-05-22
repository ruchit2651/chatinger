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

// Forgot-password is a three-step flow: request emails an OTP; verify trades
// the OTP for a short-lived reset token; reset accepts that token plus the
// new password and returns { user, token }.
export const requestPasswordReset = (payload) =>
    api.post('/auth/password/request', payload).then((r) => r.data);
export const verifyPasswordReset  = (payload) =>
    api.post('/auth/password/verify', payload).then((r) => r.data);
export const resetPassword        = (payload) =>
    api.post('/auth/password/reset', payload).then((r) => r.data);

export const me       = ()        => api.get('/auth/me').then((r) => r.data);
export const updateMe = (payload) => api.patch('/auth/me', payload).then((r) => r.data);
