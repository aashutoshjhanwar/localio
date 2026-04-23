# LOCALIO

The operating system for your neighborhood — chat, buy/sell, and hire locally.

## Monorepo

- `apps/api` — Node.js + TypeScript backend (Express, Prisma, Socket.IO)
- `apps/mobile` — React Native + Expo app
- `packages/` — shared types / utilities (TBD)

## Quick start (backend)

```bash
cd apps/api
npm install
npm run db:push      # creates SQLite db + tables
npm run db:seed      # seeds societies, users, listings, services
npm run dev          # starts API on :4000
```

Dev OTP: any phone works, use code `123456` (`OTP_DEV_BYPASS=1` in `.env`).

Admin-gated endpoints (moderation) require the caller's phone to appear in `ADMIN_PHONES` (comma-separated) in `apps/api/.env`.

## Quick start (mobile)

```bash
cd apps/mobile
npm install
npm run start         # Expo dev server — press i (iOS), a (Android), w (web)
```

On Android emulator the app auto-points to `10.0.2.2:4000`. On a real device set your Mac's LAN IP in `apps/mobile/app.json` → `extra.apiUrl`.

Login flow: `+91XXXXXXXXXX` → OTP `123456` → drops you into the feed. Try `+919000000001` after seeding.

### Screens
- **Login** — OTP auth (phone → 6-digit code)
- **Feed** — hyperlocal unified listings + services, ranked by distance × recency × rating; search bar + category grid + notification bell
- **Search** — 3-tab full-text search (listings / services / societies) with geofilter
- **Categories / CategoryFeed** — browse a category, then its nearby items
- **Services** — category-filterable provider list
- **Listing detail** — swipeable image carousel, price, seller card, save / share / report, one-tap chat
- **Create / Edit listing** — photos (expo-image-picker → base64 upload), category chips, auto-location
- **Service detail** — about, provider card, one-tap "Request booking" + chat-first option
- **Create service** — title, starting price + rate type, category, description
- **Bookings** — "My requests" / "Incoming" tabs; accept/reject/complete/cancel inline; ⭐ Rate on completed
- **Chats / ChatRoom** — real-time Socket.IO with optimistic send, AsyncStorage offline cache, 💰 in-chat price offers (accept/decline as follow-up)
- **Favorites** — saved listings
- **My posts** — manage your listings (mark sold, re-open, edit, close) and services (pause/resume)
- **User profile** — public profile, stats, trust score, received reviews
- **Inbox** — in-app notifications persisted server-side; deep-links to chat / bookings
- **Join society** — nearby society picker
- **Admin / Moderation** — open/resolved/dismissed reports, take-down action cascades to target
- **Profile** — edit name/bio, neighbourhood, offer service, my posts, saved, moderation, logout

Expo push notifications are registered post-login; new messages and booking events notify offline members.

## REST API

### Auth
- `POST /api/auth/request-otp` / `POST /api/auth/verify-otp` / `GET /api/auth/me`

### Societies
- `POST /api/societies`
- `GET  /api/societies/nearby?lat&lng&radiusKm`
- `GET  /api/societies/:id`
- `POST /api/societies/:id/join`

### Listings
- `POST   /api/listings`
- `GET    /api/listings?lat&lng&radiusKm&category&q&societyId`
- `GET    /api/listings/:id`
- `PATCH  /api/listings/:id` — seller only
- `DELETE /api/listings/:id` — seller only (soft close)

### Services
- `POST  /api/services`
- `GET   /api/services?lat&lng&radiusKm&category&q`
- `GET   /api/services/:id`
- `PATCH /api/services/:id` — provider only

### Groups
- `POST /api/groups`
- `GET  /api/groups?societyId`
- `GET  /api/groups/:id`
- `POST /api/groups/:id/join`
- `POST /api/groups/:id/leave`

### Chat
- `POST /api/chat/direct` — `{ peerId, listingId? }`
- `GET  /api/chat/conversations`
- `GET  /api/chat/conversations/:id/messages?before=ISO`
- `POST /api/chat/conversations/:id/messages`
- `POST /api/chat/conversations/:id/read`

### Ratings
- `POST /api/ratings` — `{ toId, context, contextId, stars, review? }`
- `GET  /api/ratings/user/:id`

### Bookings
- `POST /api/bookings` — `{ serviceId, scheduledAt?, notes? }` (pushes provider)
- `GET  /api/bookings?role=customer|provider`
- `POST /api/bookings/:id/status` — `{ status: accepted|rejected|completed|cancelled }`

### Favorites
- `POST /api/favorites` / `DELETE /api/favorites/:listingId` / `GET /api/favorites`

### Reports (T&S)
- `POST /api/reports` — auto-hides target after 3 open reports
- `GET  /api/reports?status=open|resolved|dismissed` — **admin**, with stats
- `POST /api/reports/:id/resolve` — **admin**, `{ action: dismiss|resolve|take_down }` (take_down closes listing / disables service and bulk-resolves all open reports on same target)
- `GET  /api/reports/target/:type/:id` — **admin**, target snapshot

### Notifications (in-app inbox)
- `GET  /api/notifications` — list + unread count
- `POST /api/notifications/read` — mark all read
- `POST /api/notifications/:id/read` — mark one read

### Devices (push)
- `POST /api/devices/register`   — `{ token, platform }`
- `POST /api/devices/unregister` — `{ token }`

### Users / Search / Categories / Uploads / Feed
- `PATCH /api/users/me`
- `GET   /api/users/me/items`     — caller's own listings + services
- `GET   /api/users/:id`          — public profile + stats
- `GET   /api/search?q&lat&lng&radiusKm` — `{ listings, services, societies }`
- `GET   /api/categories`
- `POST  /api/uploads`            — `{ filename, contentType, base64 }` → `{ url }`
- `GET   /api/feed?lat&lng&radiusKm`

## Realtime (Socket.IO)

Connect to `ws://localhost:4000` with path `/ws`, auth `{ token }`.

Events:
- `conversation:join` → `conversationId`
- `message:send` → `{ conversationId, type, body, mediaUrl?, metadata?, clientId? }` (ack)
- `message:new` (server → client)
- `typing` → `{ conversationId, isTyping }`
- `message:read` → `{ conversationId }`

## Storage adapter

`apps/api/src/storage/index.ts` exposes a `StorageAdapter` interface with a local-disk driver and an S3-compatible stub. Switch with `STORAGE_DRIVER=s3` + `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` (install `@aws-sdk/client-s3` and finish `S3Storage.put`).

## Stack

| Layer      | Tech |
|------------|------|
| Runtime    | Node 20 + TypeScript (ESM) |
| HTTP       | Express + Zod |
| DB         | SQLite (dev) → Postgres (prod) via Prisma |
| Realtime   | Socket.IO |
| Auth       | JWT + OTP (dev bypass) |
| Geo        | Geohash p6 (~1.2km cells) + Haversine ranking |
| Mobile     | Expo SDK 51, React Native 0.74, React Navigation, Zustand |
| Cache      | AsyncStorage (offline chat), SecureStore (auth) |

## Switching to Postgres

1. `docker compose up -d`
2. In `apps/api/prisma/schema.prisma` change `provider = "sqlite"` → `"postgresql"`
3. Update `DATABASE_URL` to `postgresql://localio:localio@localhost:5432/localio`
4. `npm run db:push && npm run db:seed`

## Roadmap

- [x] Monorepo scaffold, Auth (OTP + JWT), Society / Listing / Service / Chat data model
- [x] Full REST endpoints + Socket.IO chat gateway
- [x] Ratings + trust-score recompute
- [x] Hyperlocal unified feed (distance × recency × rating)
- [x] Seed script, media upload (local disk + S3-ready adapter)
- [x] Mobile app: auth, feed, listings, services, chat, profile, bookings
- [x] Favorites, reports + auto-hide, Expo push + in-app inbox
- [x] Offers in chat (send/accept/decline), price negotiation
- [x] Ratings UI on completed bookings → recomputes provider trust
- [x] My posts management, listing edit, user public profile
- [x] Admin moderation dashboard (whitelist by `ADMIN_PHONES`)
- [x] Full-text search, category browse, society onboarding, image carousel, native share
- [x] Offline chat cache (AsyncStorage)
- [ ] Aadhaar eKYC
- [ ] S3 driver finish (install `@aws-sdk/client-s3`)
- [ ] Map view for nearby listings
- [ ] Elasticsearch for scale
