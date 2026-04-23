import { prisma } from '../db/prisma.js';

// Expo Push — free, no auth key required, works for iOS + Android from one endpoint.
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  title: string;
  body: string;
  type?: string; // for inbox filtering
  data?: Record<string, unknown>;
}

export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  // Persist to inbox first — even if the user has no device token, they'll see it in-app.
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: payload.type ?? 'system',
        title: payload.title,
        body: payload.body,
        data: payload.data ? JSON.stringify(payload.data) : null,
      },
    });
  } catch {
    /* don't let inbox errors block push delivery */
  }

  // Respect per-user notification preferences — in-app inbox still gets the row above.
  const type = payload.type ?? 'system';
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
    if (u?.notificationPrefs) {
      const prefs = JSON.parse(u.notificationPrefs) as Record<string, boolean>;
      if (prefs[type] === false) return;
    }
  } catch { /* noop — default to allow */ }

  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[push] non-ok', res.status);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[push] failed', e);
  }
}

export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map((id) => pushToUser(id, payload)));
}

export async function pushToFollowers(followeeId: string, payload: PushPayload): Promise<void> {
  const rows = await prisma.follow.findMany({
    where: { followeeId },
    select: { followerId: true },
  });
  if (rows.length === 0) return;
  await pushToUsers(rows.map((r) => r.followerId), payload);
}
