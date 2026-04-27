import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { societyRouter } from './routes/societies.js';
import { listingRouter } from './routes/listings.js';
import { serviceRouter } from './routes/services.js';
import { groupRouter } from './routes/groups.js';
import { chatRouter } from './routes/chat.js';
import { ratingRouter } from './routes/ratings.js';
import { feedRouter } from './routes/feed.js';
import { uploadRouter } from './routes/uploads.js';
import { userRouter } from './routes/users.js';
import { categoryRouter } from './routes/categories.js';
import { bookingRouter } from './routes/bookings.js';
import { favoriteRouter } from './routes/favorites.js';
import { reportRouter } from './routes/reports.js';
import { deviceRouter } from './routes/devices.js';
import { searchRouter } from './routes/search.js';
import { notificationRouter } from './routes/notifications.js';
import { blockRouter } from './routes/blocks.js';
import { eventRouter } from './routes/events.js';
import { savedSearchRouter } from './routes/savedSearches.js';
import { postRouter } from './routes/posts.js';
import { pollRouter } from './routes/polls.js';
import { slotRouter } from './routes/slots.js';
import { referralRouter } from './routes/referrals.js';
import { analyticsRouter } from './routes/analytics.js';
import { followRouter } from './routes/follows.js';
import { offerRouter } from './routes/offers.js';
import { wantedRouter } from './routes/wanted.js';
import { kycRouter } from './routes/kyc.js';
import { meetupSpotRouter } from './routes/meetupSpots.js';
import { storyRouter } from './routes/stories.js';
import { quickReplyRouter } from './routes/quickReplies.js';
import { channelRouter } from './routes/channels.js';
import { sosRouter } from './routes/sos.js';
import { trustRouter } from './routes/trust.js';
import { shieldRouter } from './routes/shield.js';
import { attachChatGateway } from './realtime/chatGateway.js';
import { storage } from './storage/index.js';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'localio-api', time: Date.now() }));

app.use('/api/auth', authRouter);
app.use('/api/societies', societyRouter);
app.use('/api/listings', listingRouter);
app.use('/api/services', serviceRouter);
app.use('/api/groups', groupRouter);
app.use('/api/chat', chatRouter);
app.use('/api/ratings', ratingRouter);
app.use('/api/feed', feedRouter);
app.use('/api/uploads', uploadRouter);
app.use('/api/users', userRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/favorites', favoriteRouter);
app.use('/api/reports', reportRouter);
app.use('/api/devices', deviceRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/blocks', blockRouter);
app.use('/api/events', eventRouter);
app.use('/api/saved-searches', savedSearchRouter);
app.use('/api/posts', postRouter);
app.use('/api/polls', pollRouter);
app.use('/api/slots', slotRouter);
app.use('/api/referrals', referralRouter);
app.use('/api/admin/analytics', analyticsRouter);
app.use('/api/follows', followRouter);
app.use('/api/offers', offerRouter);
app.use('/api/wanted', wantedRouter);
app.use('/api/kyc', kycRouter);
app.use('/api/meetup-spots', meetupSpotRouter);
app.use('/api/stories', storyRouter);
app.use('/api/quick-replies', quickReplyRouter);
app.use('/api/channels', channelRouter);
app.use('/api/sos', sosRouter);
app.use('/api/trust', trustRouter);
app.use('/api/shield', shieldRouter);
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.use(errorHandler);

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: '*' },
  path: '/ws',
});
app.set('io', io);
attachChatGateway(io);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 LOCALIO api on :${env.PORT} (${env.NODE_ENV})`);
  // eslint-disable-next-line no-console
  console.log(`📦 storage driver: ${storage.kind}`);
  if (storage.kind === 'local' && env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn('⚠️  WARNING: using local-disk storage in production. Files will be lost on redeploy. Set S3_BUCKET + S3_ACCESS_KEY + S3_SECRET_KEY to switch to S3/R2/MinIO.');
  }
});
