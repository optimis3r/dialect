import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_URL, getStoredToken } from '../config';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setConnected(false);
      return;
    }

    const token = getStoredToken();
    const instance = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      timeout: 10000
    });

    instance.on('connect', () => setConnected(true));
    instance.on('disconnect', () => setConnected(false));
    instance.on('connect_error', (error) => console.error('[Socket] Error:', error.message));

    socketRef.current = instance;
    setSocket(instance);

    return () => {
      instance.removeAllListeners();
      instance.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [user]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) socketRef.current.emit(event, data);
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
