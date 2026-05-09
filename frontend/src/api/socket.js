import { io } from 'socket.io-client';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

let socket = null;

export const connectSocket = (token) => {
  if (socket?.connected) return socket;
  socket = io(BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });
  socket.on('connect',       () => console.log('⚡ Socket connected'));
  socket.on('disconnect',    () => console.log('⚡ Socket disconnected'));
  socket.on('connect_error', e  => console.warn('⚡ Socket error:', e.message));
  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

export const getSocket = () => socket;
