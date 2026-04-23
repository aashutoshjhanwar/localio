import type { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../db/prisma.js';
import { pushToUsers } from './push.js';

interface AuthedSocket extends Socket {
  userId?: string;
}

export function attachChatGateway(io: Server) {
  // Auth via handshake: { auth: { token } }
  io.use((socket: AuthedSocket, next) => {
    const token = (socket.handshake.auth?.token as string) || (socket.handshake.query?.token as string);
    if (!token) return next(new Error('missing_token'));
    try {
      const p = verifyToken(token);
      socket.userId = p.userId;
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    const uid = socket.userId!;
    socket.join(`user:${uid}`);

    prisma.user.update({ where: { id: uid }, data: { lastSeenAt: new Date() } }).catch(() => {});
    socket.on('disconnect', () => {
      prisma.user.update({ where: { id: uid }, data: { lastSeenAt: new Date() } }).catch(() => {});
    });

    // Join the rooms for every conversation the user is in
    prisma.conversationMember.findMany({ where: { userId: uid } }).then((rows) => {
      for (const r of rows) socket.join(`conv:${r.conversationId}`);
    });

    socket.on('conversation:join', async (conversationId: string) => {
      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: uid } },
      });
      if (!member) return socket.emit('error', { code: 'not_a_member' });
      socket.join(`conv:${conversationId}`);
    });

    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conv:${conversationId}`).emit('typing', { conversationId, userId: uid, isTyping });
    });

    socket.on(
      'message:send',
      async (
        payload: {
          conversationId: string;
          type?: 'text' | 'image' | 'offer' | 'system' | 'location';
          body: string;
          mediaUrl?: string;
          metadata?: unknown;
          clientId?: string;
          replyToId?: string;
        },
        ack?: (resp: any) => void,
      ) => {
        try {
          const { conversationId, body, clientId } = payload;
          const type = payload.type ?? 'text';
          if (!body || body.length > 4000) throw new Error('invalid_body');

          const member = await prisma.conversationMember.findUnique({
            where: { conversationId_userId: { conversationId, userId: uid } },
          });
          if (!member) throw new Error('not_a_member');

          const msg = await prisma.message.create({
            data: {
              conversationId,
              senderId: uid,
              type,
              body,
              mediaUrl: payload.mediaUrl,
              metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
              replyToId: payload.replyToId ?? null,
            },
            include: {
              sender: { select: { id: true, name: true, avatarUrl: true } },
              replyTo: {
                select: {
                  id: true, body: true, type: true, senderId: true,
                  sender: { select: { id: true, name: true } },
                },
              },
            },
          });
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          io.to(`conv:${conversationId}`).emit('message:new', { ...msg, clientId });
          ack?.({ ok: true, message: msg, clientId });

          // Push notify offline members
          prisma.conversationMember.findMany({
            where: { conversationId, userId: { not: uid } },
          }).then((members) => {
            const now = Date.now();
            const others = members
              .filter((m) => !m.mutedUntil || new Date(m.mutedUntil).getTime() <= now)
              .map((m) => m.userId);
            if (others.length === 0) return;
            pushToUsers(others, {
              type: 'chat',
              title: msg.sender?.name ?? 'New message',
              body: type === 'text' ? body.slice(0, 120) : `[${type}]`,
              data: { conversationId },
            }).catch(() => {});
          }).catch(() => {});
        } catch (err: any) {
          ack?.({ ok: false, error: err.message ?? 'send_failed' });
        }
      },
    );

    socket.on('message:read', async ({ conversationId }: { conversationId: string }) => {
      try {
        await prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId: uid } },
          data: { lastReadAt: new Date() },
        });
        socket.to(`conv:${conversationId}`).emit('message:read', { conversationId, userId: uid, at: new Date() });
      } catch { /* ignore */ }
    });

    socket.on('disconnect', () => {
      // Presence bookkeeping could go here
    });
  });
}
