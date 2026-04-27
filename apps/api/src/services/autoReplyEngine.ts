import { prisma } from '../db/prisma.js';
import { distanceKm } from '../utils/geo.js';

const DEFAULT_GREETING = 'Hi! Thanks for your interest. I\'ll respond personally as soon as I\'m free — meanwhile a few quick details below.';
const GHOST_THRESHOLD_HOURS = 24;

interface FireAutoReplyResult {
  greetingMessage?: any;
  ghostHintMessage?: any;
}

// Called after a buyer sends a message in a listing-tied direct conversation.
// Returns any system messages we generated so the gateway can broadcast them.
export async function maybeFireAutoReply(opts: {
  conversationId: string;
  buyerId: string;
  buyerText: string;
}): Promise<FireAutoReplyResult> {
  const conv = await prisma.conversation.findUnique({
    where: { id: opts.conversationId },
    select: { id: true, type: true, listingId: true, members: { select: { userId: true } } },
  });
  if (!conv || conv.type !== 'direct' || !conv.listingId) return {};

  const sellerMember = conv.members.find((m) => m.userId !== opts.buyerId);
  if (!sellerMember) return {};
  const sellerId = sellerMember.userId;

  const listing = await prisma.listing.findUnique({
    where: { id: conv.listingId },
    select: {
      id: true, title: true, priceInPaise: true, negotiable: true,
      sellerId: true, lat: true, lng: true, category: true,
    },
  });
  if (!listing || listing.sellerId !== sellerId) return {};

  const result: FireAutoReplyResult = {};

  // --- 1. First-message greeting
  const priorBotMessages = await prisma.message.count({
    where: {
      conversationId: opts.conversationId,
      type: 'system',
      // any prior bot system messages (we tag in metadata)
    },
  });
  const buyerMessageCount = await prisma.message.count({
    where: { conversationId: opts.conversationId, senderId: opts.buyerId, type: 'text' },
  });
  // buyerMessageCount === 1 means this is the first message they just sent.
  if (buyerMessageCount <= 1 && priorBotMessages === 0) {
    const greeting = await pickGreeting(sellerId, listing.id);
    const card = listingCard(listing);
    const body = `🤖 LOCALIO Assist — ${greeting}\n\n${card}`;
    const msg = await prisma.message.create({
      data: {
        conversationId: opts.conversationId,
        senderId: sellerId,
        type: 'system',
        body,
        metadata: JSON.stringify({
          kind: 'auto_reply',
          variant: 'greeting',
          listingId: listing.id,
          quickReplies: ['Is it still available?', 'Best price?', 'Where can we meet?'],
        }),
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    });
    result.greetingMessage = msg;
  }

  // --- 2. FAQ trigger match
  const text = opts.buyerText.toLowerCase();
  const faqs = await prisma.autoReply.findMany({
    where: {
      userId: sellerId, kind: 'faq', enabled: true,
      OR: [{ listingId: listing.id }, { listingId: null }],
    },
  });
  for (const f of faqs) {
    if (!f.triggerText) continue;
    if (text.includes(f.triggerText.toLowerCase())) {
      const msg = await prisma.message.create({
        data: {
          conversationId: opts.conversationId,
          senderId: sellerId,
          type: 'system',
          body: `🤖 ${f.response}`,
          metadata: JSON.stringify({ kind: 'auto_reply', variant: 'faq', autoReplyId: f.id }),
        },
        include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
      });
      // Reuse greeting slot if not already filled, else attach to ghostHint slot
      if (!result.greetingMessage) result.greetingMessage = msg;
      else result.ghostHintMessage = msg;
      break; // only one FAQ per buyer message
    }
  }

  // --- 3. Ghost detector: if seller's last actual reply > N hours ago and buyer is still active
  const lastSellerMsg = await prisma.message.findFirst({
    where: { conversationId: opts.conversationId, senderId: sellerId, type: { in: ['text', 'image', 'offer', 'location'] } },
    orderBy: { createdAt: 'desc' },
  });
  const hoursSilent = lastSellerMsg
    ? (Date.now() - lastSellerMsg.createdAt.getTime()) / 3_600_000
    : Infinity;
  if (hoursSilent > GHOST_THRESHOLD_HOURS && buyerMessageCount >= 2) {
    const similar = await findSimilarListings(listing);
    if (similar.length > 0) {
      const lines = similar.map((s) =>
        `• ${s.title} — ₹${Math.round(s.priceInPaise / 100).toLocaleString('en-IN')} · ${s.distanceKm.toFixed(1)} km`,
      ).join('\n');
      const msg = await prisma.message.create({
        data: {
          conversationId: opts.conversationId,
          senderId: sellerId, // attribute to seller so it shows in their bubble color, but flag system
          type: 'system',
          body: `🤖 The seller hasn't replied in ${Math.round(hoursSilent)}h. While you wait, similar listings nearby:\n\n${lines}`,
          metadata: JSON.stringify({
            kind: 'auto_reply',
            variant: 'ghost_hint',
            similarListingIds: similar.map((s) => s.id),
          }),
        },
        include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
      });
      result.ghostHintMessage = msg;
    }
  }

  return result;
}

async function pickGreeting(sellerId: string, listingId: string): Promise<string> {
  const greeting = await prisma.autoReply.findFirst({
    where: {
      userId: sellerId, kind: 'greeting', enabled: true,
      OR: [{ listingId }, { listingId: null }],
    },
    orderBy: [{ listingId: 'desc' }, { sortOrder: 'asc' }], // listing-specific wins
  });
  return greeting?.response ?? DEFAULT_GREETING;
}

function listingCard(listing: { title: string; priceInPaise: number; negotiable: boolean; category: string }): string {
  const price = `₹${Math.round(listing.priceInPaise / 100).toLocaleString('en-IN')}`;
  const tag = listing.negotiable ? ' (negotiable)' : '';
  return `📦 ${listing.title}\n💰 ${price}${tag}\n🏷️ ${listing.category}`;
}

async function findSimilarListings(listing: { id: string; category: string; lat: number; lng: number; priceInPaise: number }) {
  const comps = await prisma.listing.findMany({
    where: {
      category: listing.category,
      status: 'active',
      id: { not: listing.id },
    },
    select: { id: true, title: true, priceInPaise: true, lat: true, lng: true },
    take: 80,
  });
  return comps
    .map((c) => ({ ...c, distanceKm: distanceKm(listing.lat, listing.lng, c.lat, c.lng) }))
    .filter((c) => c.distanceKm <= 25)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 3);
}
