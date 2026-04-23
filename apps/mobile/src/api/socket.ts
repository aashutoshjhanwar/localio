import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';
import { useAuth } from '../state/auth';

let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = useAuth.getState().token;
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();
  socket = io(API_URL, {
    path: '/ws',
    transports: ['websocket'],
    auth: { token },
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
