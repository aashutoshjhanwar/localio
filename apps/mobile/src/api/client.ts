import { API_URL } from '../config';
import { useAuth } from '../state/auth';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as any),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'error', data.message);
  }
  return data as T;
}

export const Api = {
  // auth
  requestOtp: (phone: string) =>
    api('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string, referralCode?: string) =>
    api<{ token: string; user: any }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code, referralCode }),
    }),
  myReferrals: () =>
    api<{ code: string; count: number; referrals: any[]; referredBy: any }>('/api/referrals/me'),
  referralLeaderboard: (opts: { societyId?: string; days?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.societyId) q.set('societyId', opts.societyId);
    if (opts.days) q.set('days', String(opts.days));
    const qs = q.toString();
    return api<{
      leaderboard: Array<{ rank: number; userId: string; count: number; user: any; isMe: boolean }>;
      me: { rank: number; userId: string; count: number; user: any; isMe: boolean } | null;
    }>(`/api/referrals/leaderboard${qs ? `?${qs}` : ''}`);
  },
  follow: (userId: string) => api<{ ok: true }>(`/api/follows/${userId}`, { method: 'POST' }),
  unfollow: (userId: string) => api<{ ok: true }>(`/api/follows/${userId}`, { method: 'DELETE' }),
  followStats: (userId: string) =>
    api<{ followers: number; following: number; iFollow: boolean }>(`/api/follows/user/${userId}`),
  following: () => api<{ following: any[] }>('/api/follows/me'),

  // offers
  makeOffer: (body: { listingId: string; amountInPaise: number; message?: string }) =>
    api<{ offer: any }>('/api/offers', { method: 'POST', body: JSON.stringify(body) }),
  listingOffers: (listingId: string) =>
    api<{ offers: any[] }>(`/api/offers/listing/${listingId}`),
  myOffers: () => api<{ offers: any[] }>('/api/offers/mine'),
  receivedOffers: () => api<{ offers: any[] }>('/api/offers/received'),
  acceptOffer: (id: string) =>
    api<{ offer: any }>(`/api/offers/${id}/accept`, { method: 'POST' }),
  declineOffer: (id: string) =>
    api<{ offer: any }>(`/api/offers/${id}/decline`, { method: 'POST' }),
  withdrawOffer: (id: string) =>
    api<{ offer: any }>(`/api/offers/${id}/withdraw`, { method: 'POST' }),
  counterOffer: (id: string, amountInPaise: number, message?: string) =>
    api<{ offer: any }>(`/api/offers/${id}/counter`, { method: 'POST', body: JSON.stringify({ amountInPaise, message }) }),
  acceptCounter: (id: string) =>
    api<{ offer: any }>(`/api/offers/${id}/accept-counter`, { method: 'POST' }),
  boostListing: (id: string, hours = 24) =>
    api<{ listing: any }>(`/api/listings/${id}/boost`, { method: 'POST', body: JSON.stringify({ hours }) }),
  bumpListing: (id: string) =>
    api<{ listing: any }>(`/api/listings/${id}/bump`, { method: 'POST' }),
  renewListing: (id: string) =>
    api<{ listing: any }>(`/api/listings/${id}/renew`, { method: 'POST' }),
  priceHint: (category: string, lat: number, lng: number, radiusKm = 25) =>
    api<{ hint: { p25: number; p50: number; p75: number; sampleSize: number } | null }>(
      `/api/listings/price-hint?category=${encodeURIComponent(category)}&lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
    ),
  listingStats: (id: string) =>
    api<{ stats: { views: number; favorites: number; offers: number; pendingOffers: number; chats: number } }>(
      `/api/listings/${id}/stats`,
    ),
  trendingListings: (lat: number, lng: number, radiusKm = 15, limit = 10) =>
    api<{ listings: any[] }>(
      `/api/listings/trending?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&limit=${limit}`,
    ),
  dealsNearby: (lat: number, lng: number, radiusKm = 15, limit = 30) =>
    api<{ listings: any[] }>(
      `/api/listings/deals?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&limit=${limit}`,
    ),
  relistListing: (id: string) =>
    api<{ listing: any }>(`/api/listings/${id}/relist`, { method: 'POST' }),
  reserveListing: (id: string) =>
    api<{ listing: any }>(`/api/listings/${id}/reserve`, { method: 'POST' }),
  unreserveListing: (id: string) =>
    api<{ listing: any }>(`/api/listings/${id}/unreserve`, { method: 'POST' }),
  similarListings: (id: string, limit = 10) =>
    api<{ listings: any[] }>(`/api/listings/${id}/similar?limit=${limit}`),
  priceHistory: (id: string) =>
    api<{ history: Array<{ id: string; oldPriceInPaise: number; newPriceInPaise: number; changedAt: string }> }>(
      `/api/listings/${id}/price-history`,
    ),
  hideListing: (id: string) => api<{ ok: true }>(`/api/listings/${id}/hide`, { method: 'POST' }),
  unhideListing: (id: string) => api<{ ok: true }>(`/api/listings/${id}/hide`, { method: 'DELETE' }),

  // wanted / requests
  wantedList: (lat: number, lng: number, radiusKm = 15, category?: string) => {
    const qs = new URLSearchParams({ lat: String(lat), lng: String(lng), radiusKm: String(radiusKm) });
    if (category) qs.set('category', category);
    return api<{ wanted: any[] }>(`/api/wanted?${qs.toString()}`);
  },
  createWanted: (body: { title: string; description: string; category: string; maxBudgetPaise?: number; lat: number; lng: number }) =>
    api<{ wanted: any }>('/api/wanted', { method: 'POST', body: JSON.stringify(body) }),
  wanted: (id: string) => api<{ wanted: any }>(`/api/wanted/${id}`),
  myWanted: () => api<{ wanted: any[] }>('/api/wanted/mine'),
  respondWanted: (id: string) =>
    api<{ conversation: { id: string } }>(`/api/wanted/${id}/respond`, { method: 'POST' }),
  closeWanted: (id: string) =>
    api<{ wanted: any }>(`/api/wanted/${id}/close`, { method: 'POST' }),

  // kyc
  submitKyc: (body: { docType: 'aadhaar' | 'pan' | 'dl' | 'passport'; docUrl: string; selfieUrl: string }) =>
    api<{ submission: any }>('/api/kyc', { method: 'POST', body: JSON.stringify(body) }),
  myKyc: () => api<{ submissions: any[] }>('/api/kyc/mine'),
  pendingKyc: () => api<{ submissions: any[] }>('/api/kyc/admin/pending'),
  approveKyc: (id: string) =>
    api<{ submission: any }>(`/api/kyc/admin/${id}/approve`, { method: 'POST' }),
  rejectKyc: (id: string, reason?: string) =>
    api<{ submission: any }>(`/api/kyc/admin/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  listingChatters: (id: string) =>
    api<{ chatters: Array<{ id: string; name: string | null; avatarUrl: string | null }> }>(`/api/listings/${id}/chatters`),
  markListingSold: (id: string, buyerId?: string) =>
    api<{ listing: any }>(`/api/listings/${id}/mark-sold`, { method: 'POST', body: JSON.stringify({ buyerId }) }),
  me: () => api<{ user: any }>('/api/auth/me'),

  // feed
  feed: (lat: number, lng: number, radiusKm = 10, category?: string) =>
    api<{ feed: any[] }>(`/api/feed?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}${category ? `&category=${encodeURIComponent(category)}` : ''}`),

  // listings
  listings: (q: Record<string, string | number | undefined> = {}) => {
    const qs = Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return api<{ listings: any[] }>(`/api/listings${qs ? '?' + qs : ''}`);
  },
  listing: (id: string) => api<{ listing: any }>(`/api/listings/${id}`),
  createListing: (body: any) =>
    api<{ listing: any }>('/api/listings', { method: 'POST', body: JSON.stringify(body) }),

  // services
  services: (q: Record<string, any> = {}) => {
    const qs = Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return api<{ services: any[] }>(`/api/services${qs ? '?' + qs : ''}`);
  },
  service: (id: string) => api<{ service: any }>(`/api/services/${id}`),
  createService: (body: any) =>
    api<{ service: any }>('/api/services', { method: 'POST', body: JSON.stringify(body) }),

  // chat
  directChat: (peerId: string, listingId?: string) =>
    api<{ conversation: any }>('/api/chat/direct', {
      method: 'POST',
      body: JSON.stringify({ peerId, listingId }),
    }),
  conversations: (archived = false) =>
    api<{ conversations: any[] }>(`/api/chat/conversations${archived ? '?archived=1' : ''}`),
  archiveConversation: (conversationId: string, archived = true) =>
    api<{ ok: true; archived: boolean }>(`/api/chat/conversations/${conversationId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archived }),
    }),
  muteConversation: (conversationId: string, hours: number | null) =>
    api<{ ok: true; mutedUntil: string | null }>(`/api/chat/conversations/${conversationId}/mute`, {
      method: 'POST',
      body: JSON.stringify(hours === null ? {} : { hours }),
    }),
  conversation: (conversationId: string) =>
    api<{ conversation: { id: string; type: string; listingId: string | null; peer: any; peerLastReadAt: string | null; listing: any; muted: boolean; mutedUntil: string | null; pinned: { id: string; body: string; type: string; sender: { id: string; name: string }; pinnedAt: string; pinnedById: string } | null } }>(
      `/api/chat/conversations/${conversationId}`,
    ),
  pinMessage: (conversationId: string, messageId: string) =>
    api(`/api/chat/conversations/${conversationId}/pin`, { method: 'POST', body: JSON.stringify({ messageId }) }),
  unpinMessage: (conversationId: string) =>
    api(`/api/chat/conversations/${conversationId}/pin`, { method: 'DELETE' }),
  searchMessages: (conversationId: string, q: string) =>
    api<{ messages: any[] }>(`/api/chat/conversations/${conversationId}/search?q=${encodeURIComponent(q)}`),
  messages: (conversationId: string, before?: string) =>
    api<{ messages: any[] }>(
      `/api/chat/conversations/${conversationId}/messages${before ? '?before=' + before : ''}`,
    ),
  markRead: (conversationId: string) =>
    api(`/api/chat/conversations/${conversationId}/read`, { method: 'POST' }),
  sendMessage: (conversationId: string, body: { type?: 'text' | 'image' | 'offer' | 'location'; body: string; mediaUrl?: string; metadata?: any; replyToId?: string }) =>
    api<{ message: any }>(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  chatUnread: () => api<{ unread: number }>('/api/chat/unread'),
  updateMessage: (messageId: string, patch: { metadata?: any; body?: string }) =>
    api<{ message: any }>(`/api/chat/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteMessage: (messageId: string) =>
    api<{ ok: true }>(`/api/chat/messages/${messageId}`, { method: 'DELETE' }),
  reactMessage: (messageId: string, emoji: string) =>
    api<{ ok: true; added: boolean; reactions: Array<{ emoji: string; userId: string }> }>(
      `/api/chat/messages/${messageId}/react`,
      { method: 'POST', body: JSON.stringify({ emoji }) },
    ),

  // meetup spots
  meetupSpots: (lat: number, lng: number, radiusKm = 10) =>
    api<{ spots: Array<{ id: string; name: string; address: string; lat: number; lng: number; kind: string; distanceKm: number }> }>(
      `/api/meetup-spots?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
    ),
  addMeetupSpot: (body: { name: string; address: string; lat: number; lng: number; kind?: string }) =>
    api<{ spot: any }>('/api/meetup-spots', { method: 'POST', body: JSON.stringify(body) }),
  deleteMeetupSpot: (id: string) => api(`/api/meetup-spots/${id}`, { method: 'DELETE' }),

  // upload (base64)
  upload: (filename: string, contentType: string, base64: string) =>
    api<{ url: string }>('/api/uploads', {
      method: 'POST',
      body: JSON.stringify({ filename, contentType, base64 }),
    }),

  // societies
  nearbySocieties: (lat: number, lng: number, radiusKm = 5) =>
    api<{ societies: any[] }>(`/api/societies/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
  joinSociety: (id: string) =>
    api(`/api/societies/${id}/join`, { method: 'POST' }),

  // categories
  categories: () => api<{ listings: any[]; services: any[] }>('/api/categories'),

  // user
  updateMe: (body: any) => api<{ user: any }>('/api/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  notificationPrefs: () => api<{ prefs: Record<string, boolean> }>('/api/users/me/prefs'),
  updateNotificationPrefs: (patch: Record<string, boolean>) =>
    api<{ prefs: Record<string, boolean> }>('/api/users/me/prefs', { method: 'PATCH', body: JSON.stringify(patch) }),
  user: (id: string) => api<{ user: any }>(`/api/users/${id}`),
  myItems: () => api<{ listings: any[]; services: any[] }>('/api/users/me/items'),
  updateListing: (id: string, body: any) =>
    api<{ listing: any }>(`/api/listings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteListing: (id: string) =>
    api(`/api/listings/${id}`, { method: 'DELETE' }),
  updateService: (id: string, body: any) =>
    api<{ service: any }>(`/api/services/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // bookings
  book: (body: { serviceId: string; scheduledAt?: string; notes?: string; slotId?: string }) =>
    api<{ booking: any }>('/api/bookings', { method: 'POST', body: JSON.stringify(body) }),

  // service slots
  serviceSlots: (serviceId: string) =>
    api<{ slots: any[] }>(`/api/slots/service/${serviceId}`),
  createSlot: (body: { serviceId: string; startsAt: string; endsAt: string }) =>
    api<{ slot: any }>('/api/slots', { method: 'POST', body: JSON.stringify(body) }),
  deleteSlot: (id: string) => api(`/api/slots/${id}`, { method: 'DELETE' }),
  bookings: (role: 'customer' | 'provider' = 'customer') =>
    api<{ bookings: any[] }>(`/api/bookings?role=${role}`),
  setBookingStatus: (id: string, status: string) =>
    api(`/api/bookings/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  // favorites
  favorite: (listingId: string) => api('/api/favorites', { method: 'POST', body: JSON.stringify({ listingId }) }),
  unfavorite: (listingId: string) => api(`/api/favorites/${listingId}`, { method: 'DELETE' }),
  favorites: () => api<{ favorites: any[] }>('/api/favorites'),
  favoriteService: (serviceId: string) => api('/api/favorites/service', { method: 'POST', body: JSON.stringify({ serviceId }) }),
  unfavoriteService: (serviceId: string) => api(`/api/favorites/service/${serviceId}`, { method: 'DELETE' }),
  favoriteServices: () => api<{ favorites: any[] }>('/api/favorites/services'),

  // stories
  stories: (lat: number, lng: number, radiusKm = 15) =>
    api<{ groups: Array<{ user: { id: string; name: string; avatarUrl: string | null }; stories: any[]; hasUnseen: boolean; latestAt: string }> }>(
      `/api/stories?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
    ),
  createStory: (body: { body: string; mediaUrl?: string; lat: number; lng: number; societyId?: string }) =>
    api<{ story: any }>('/api/stories', { method: 'POST', body: JSON.stringify(body) }),
  viewStory: (id: string) => api(`/api/stories/${id}/view`, { method: 'POST' }),
  deleteStory: (id: string) => api(`/api/stories/${id}`, { method: 'DELETE' }),
  quickReplies: () => api<{ replies: Array<{ id: string; text: string; createdAt: string }> }>('/api/quick-replies'),
  addQuickReply: (text: string) =>
    api<{ reply: { id: string; text: string; createdAt: string } }>('/api/quick-replies', { method: 'POST', body: JSON.stringify({ text }) }),
  deleteQuickReply: (id: string) => api(`/api/quick-replies/${id}`, { method: 'DELETE' }),

  storyViews: (id: string) =>
    api<{ views: Array<{ user: { id: string; name: string; avatarUrl: string | null } | null; viewedAt: string }> }>(
      `/api/stories/${id}/views`,
    ),

  // reports
  report: (body: { targetType: 'listing' | 'service' | 'user' | 'message' | 'post'; targetId: string; reason: string; notes?: string }) =>
    api('/api/reports', { method: 'POST', body: JSON.stringify(body) }),

  // ratings
  rate: (body: { toId: string; context: 'listing' | 'service'; contextId: string; stars: number; review?: string; photoUrls?: string[] }) =>
    api<{ rating: any }>('/api/ratings', { method: 'POST', body: JSON.stringify(body) }),
  userRatings: (userId: string) =>
    api<{ ratings: any[] }>(`/api/ratings/user/${userId}`),
  userItems: (userId: string) =>
    api<{ listings: any[]; services: any[] }>(`/api/users/${userId}/items`),
  serviceRatings: (serviceId: string) =>
    api<{ ratings: any[] }>(`/api/ratings/service/${serviceId}`),
  listingRatings: (listingId: string) =>
    api<{ ratings: any[] }>(`/api/ratings/listing/${listingId}`),

  // search
  search: (qs: string) =>
    api<{ listings: any[]; services: any[]; societies: any[] }>(`/api/search?${qs}`),

  // notifications
  notifications: () =>
    api<{ notifications: any[]; unread: number }>('/api/notifications'),
  markAllNotificationsRead: () =>
    api('/api/notifications/read', { method: 'POST' }),
  markNotificationRead: (id: string) =>
    api(`/api/notifications/${id}/read`, { method: 'POST' }),

  // admin moderation
  adminReports: (status: 'open' | 'resolved' | 'dismissed' = 'open') =>
    api<{ reports: any[]; stats: { open: number; resolved: number; dismissed: number } }>(`/api/reports?status=${status}`),
  adminResolveReport: (id: string, action: 'dismiss' | 'resolve' | 'take_down') =>
    api(`/api/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action }) }),
  adminReportTarget: (type: string, id: string) =>
    api<{ target: any }>(`/api/reports/target/${type}/${id}`),
  adminAnalytics: () => api<{
    totals: Record<string, number>;
    growth7d: Record<string, number>;
    growth30d: Record<string, number>;
    moderation: { reportsOpen: number; reportsResolved: number };
    bookingsByStatus: Array<{ status: string; count: number }>;
    topCategories: Array<{ category: string; count: number }>;
    dailySignups: Array<{ date: string; count: number }>;
  }>('/api/admin/analytics/overview'),

  // blocks
  blocks: () => api<{ blocks: any[] }>('/api/blocks'),
  block: (userId: string) =>
    api('/api/blocks', { method: 'POST', body: JSON.stringify({ userId }) }),
  unblock: (userId: string) => api(`/api/blocks/${userId}`, { method: 'DELETE' }),

  // saved searches
  savedSearches: () => api<{ savedSearches: any[] }>('/api/saved-searches'),
  saveSearch: (body: any) =>
    api<{ savedSearch: any }>('/api/saved-searches', { method: 'POST', body: JSON.stringify(body) }),
  deleteSavedSearch: (id: string) => api(`/api/saved-searches/${id}`, { method: 'DELETE' }),
  markSavedSearchSeen: (id: string) => api(`/api/saved-searches/${id}/seen`, { method: 'POST' }),

  // community posts
  posts: (lat: number, lng: number, kind?: string, radiusKm = 15) => {
    const qs = `lat=${lat}&lng=${lng}&radiusKm=${radiusKm}${kind ? `&kind=${kind}` : ''}`;
    return api<{ posts: any[] }>(`/api/posts?${qs}`);
  },
  post: (id: string) => api<{ post: any; upvoted: boolean; likedCommentIds: string[] }>(`/api/posts/${id}`),
  likeComment: (id: string) => api<{ likes: number }>(`/api/posts/comments/${id}/like`, { method: 'POST' }),
  unlikeComment: (id: string) => api<{ likes: number }>(`/api/posts/comments/${id}/like`, { method: 'DELETE' }),
  createPost: (body: any) =>
    api<{ post: any }>('/api/posts', { method: 'POST', body: JSON.stringify(body) }),
  commentPost: (id: string, body: string) =>
    api<{ comment: any }>(`/api/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  upvotePost: (id: string) => api(`/api/posts/${id}/upvote`, { method: 'POST' }),
  unvotePost: (id: string) => api(`/api/posts/${id}/upvote`, { method: 'DELETE' }),
  deletePost: (id: string) => api(`/api/posts/${id}`, { method: 'DELETE' }),

  // polls
  polls: (lat: number, lng: number, radiusKm = 15) =>
    api<{ polls: any[] }>(`/api/polls?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
  poll: (id: string) => api<{ poll: any; myOptionId: string | null }>(`/api/polls/${id}`),
  createPoll: (body: { question: string; options: string[]; lat: number; lng: number; closesAt?: string }) =>
    api<{ poll: any }>('/api/polls', { method: 'POST', body: JSON.stringify(body) }),
  votePoll: (id: string, optionId: string) =>
    api(`/api/polls/${id}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) }),
  deletePoll: (id: string) => api(`/api/polls/${id}`, { method: 'DELETE' }),

  // events
  events: (lat: number, lng: number, radiusKm = 15) =>
    api<{ events: any[] }>(`/api/events?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
  event: (id: string) => api<{ event: any; myRsvp: any }>(`/api/events/${id}`),
  createEvent: (body: any) =>
    api<{ event: any }>('/api/events', { method: 'POST', body: JSON.stringify(body) }),
  rsvpEvent: (id: string, status: 'going' | 'interested') =>
    api(`/api/events/${id}/rsvp`, { method: 'POST', body: JSON.stringify({ status }) }),
  cancelRsvp: (id: string) => api(`/api/events/${id}/rsvp`, { method: 'DELETE' }),
  deleteEvent: (id: string) => api(`/api/events/${id}`, { method: 'DELETE' }),

  // devices (push)
  registerDevice: (token: string, platform: 'ios' | 'android' | 'web') =>
    api('/api/devices/register', { method: 'POST', body: JSON.stringify({ token, platform }) }),

  // groups + channels
  myGroups: () => api<{ groups: any[] }>('/api/groups/mine'),
  group: (id: string) => api<{ group: any; membership: any }>(`/api/groups/${id}`),
  joinGroup: (id: string) => api<{ ok: true }>(`/api/groups/${id}/join`, { method: 'POST' }),
  leaveGroup: (id: string) => api<{ ok: true }>(`/api/groups/${id}/leave`, { method: 'POST' }),
  groupMembers: (id: string) => api<{ members: any[] }>(`/api/groups/${id}/members`),
  groupAnnouncements: (id: string) =>
    api<{ announcements: any[] }>(`/api/groups/${id}/announcements`),
  createAnnouncement: (id: string, body: { title: string; body: string }) =>
    api<{ announcement: any }>(`/api/groups/${id}/announcements`, { method: 'POST', body: JSON.stringify(body) }),
  setMemberRole: (groupId: string, userId: string, role: 'member' | 'admin') =>
    api(`/api/groups/${groupId}/members/${userId}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
  kickMember: (groupId: string, userId: string) =>
    api(`/api/groups/${groupId}/members/${userId}/kick`, { method: 'POST' }),
  muteMember: (groupId: string, userId: string, hours: number) =>
    api(`/api/groups/${groupId}/members/${userId}/mute`, { method: 'POST', body: JSON.stringify({ hours }) }),

  groupChannels: (groupId: string) =>
    api<{ channels: any[] }>(`/api/channels/group/${groupId}`),
  channel: (id: string) =>
    api<{ channel: any; messages: any[] }>(`/api/channels/${id}`),

  // uploads
  presignUpload: (body: { filename: string; contentType: string; size?: number }) =>
    api<{
      driver: 'local' | 's3';
      uploadUrl: string | null;
      publicUrl: string | null;
      headers?: Record<string, string>;
      fallback?: string;
      key: string;
      expiresAt?: string;
    }>('/api/uploads/presign', { method: 'POST', body: JSON.stringify(body) }),
  uploadBase64: (body: { filename: string; contentType: string; base64: string }) =>
    api<{ url: string; key: string }>('/api/uploads', { method: 'POST', body: JSON.stringify(body) }),
  deleteUpload: (key: string) =>
    api<{ ok: true }>('/api/uploads', { method: 'DELETE', body: JSON.stringify({ key }) }),

  // trust
  myTrust: () => api<{ trust: { score: number; tier: any; components: any; suggestions: string[] } }>('/api/trust/me'),
  userTrust: (userId: string) => api<{ trust: { score: number; tier: any; components: any } }>(`/api/trust/${userId}`),

  // scam shield
  assessText: (text: string) =>
    api<{ assessment: { risk: 'clean' | 'low' | 'medium' | 'high'; flags: Array<{ kind: string; severity: string; reason: string; excerpt?: string }>; advice?: string } }>(
      '/api/shield/assess', { method: 'POST', body: JSON.stringify({ text }) }
    ),
  gradeListing: (body: {
    title: string; description: string; category: string; priceInPaise: number;
    images: string[]; attributes?: Record<string, any> | null; lat: number; lng: number;
  }) => api<{ report: {
    score: number; grade: 'A' | 'B' | 'C' | 'D';
    issues: Array<{ field: string; severity: 'info' | 'warn' | 'blocker'; message: string; pointsLost: number }>;
    priceSuggestion?: { lowPaise: number; medianPaise: number; highPaise: number; sample: number };
    canPublish: boolean;
  } }>('/api/shield/grade-listing', { method: 'POST', body: JSON.stringify(body) }),

  // global chat search
  searchAllChats: (q: string) =>
    api<{ results: Array<{
      messageId: string; body: string; type: string; createdAt: string;
      sender: { id: string; name: string | null; avatarUrl: string | null };
      conversationId: string;
      conversationType: string;
      channel: { id: string; name: string; emoji: string | null; groupId: string } | null;
      group: { id: string; name: string } | null;
      peer: { id: string; name: string | null } | null;
    }> }>(`/api/chat/search?q=${encodeURIComponent(q)}`),

  // sos
  sendSos: (body: { lat: number; lng: number; body: string; category?: 'medical' | 'security' | 'fire' | 'other'; radiusKm?: number }) =>
    api<{ ok: true; reached: number; channelId?: string }>('/api/sos', { method: 'POST', body: JSON.stringify(body) }),
};
