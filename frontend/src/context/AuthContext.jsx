import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // On boot: if we have a token, fetch the current user so a refresh keeps us logged in.
    useEffect(() => {
        let cancelled = false;
        async function boot() {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const { user } = await authApi.me();
                if (!cancelled) setUser(user);
            } catch {
                localStorage.removeItem('token');
                if (!cancelled) {
                    setToken(null);
                    setUser(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        boot();
        return () => { cancelled = true; };
    }, [token]);

    // Apply the result of a successful OTP verify (sets token + user).
    const applySession = useCallback((session) => {
        localStorage.setItem('token', session.token);
        setToken(session.token);
        setUser(session.user);
        return session.user;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, loading, logout, setUser, applySession }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
