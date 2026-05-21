import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io as createSocket } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
    const { token } = useAuth();
    const socketRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        if (!token) return;

        const s = createSocket(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });

        socketRef.current = s;
        setSocket(s);

        s.on('online_users', (ids) => setOnlineUsers(ids));

        return () => {
            s.removeAllListeners();
            s.disconnect();
            socketRef.current = null;
            setSocket(null);
            setOnlineUsers([]);
        };
    }, [token]);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
}

export const useSocket = () => useContext(SocketContext);
