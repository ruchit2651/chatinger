import api from './axios';

export const uploadAttachment = (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/uploads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
};
