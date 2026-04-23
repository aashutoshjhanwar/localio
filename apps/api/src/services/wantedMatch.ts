import { prisma } from '../db/prisma.js';
import { neighborGeohashes, distanceKm } from '../utils/geo.js';
import { pushToUser } from '../realtime/push.js';

const MATCH_RADIUS_KM = 15;

/**
 * New listing posted → notify buyers with matching open Wanted posts
 * (same category, within radius, listing price ≤ maxBudget if set).
 */
export async function notifyWantedMatchesForListing(listing: {
  id: string; sellerId: string; title: string; category: string;
  priceInPaise: number; lat: number; lng: number; geohash: string;
}) {
  const candidates = await prisma.wanted.findMany({
    where: {
      status: 'open',
      category: listing.category,
      buyerId: { not: listing.sellerId },
      geohash: { in: neighborGeohashes(listing.geohash) },
    },
    take: 50,
  });
  const matches = candidates.filter((w) => {
    if (w.maxBudgetPaise != null && listing.priceInPaise > w.maxBudgetPaise) return false;
    const d = distanceKm(listing.lat, listing.lng, w.lat, w.lng);
    return d <= MATCH_RADIUS_KM;
  });
  if (!matches.length) return;

  await prisma.notification.createMany({
    data: matches.map((w) => ({
      userId: w.buyerId,
      type: 'wanted_match',
      title: 'Found a match for your request',
      body: listing.title.slice(0, 100),
      data: JSON.stringify({ wantedId: w.id, listingId: listing.id }),
    })),
  });
  await Promise.all(matches.map((w) => pushToUser(w.buyerId, {
    title: '🎯 Match for what you wanted',
    body: listing.title.slice(0, 100),
    type: 'wanted_match',
    data: { wantedId: w.id, listingId: listing.id },
  }).catch(() => {})));
}

/**
 * New Wanted posted → notify sellers whose active listings match
 * (same category, within radius, price ≤ maxBudget if set).
 */
export async function notifyListingMatchesForWanted(w: {
  id: string; buyerId: string; title: string; category: string;
  maxBudgetPaise: number | null; lat: number; lng: number; geohash: string;
}) {
  const priceFilter = w.maxBudgetPaise != null ? { priceInPaise: { lte: w.maxBudgetPaise } } : {};
  const candidates = await prisma.listing.findMany({
    where: {
      status: 'active',
      category: w.category,
      sellerId: { not: w.buyerId },
      geohash: { in: neighborGeohashes(w.geohash) },
      ...priceFilter,
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });
  const matches = candidates
    .map((l) => ({ l, d: distanceKm(w.lat, w.lng, l.lat, l.lng) }))
    .filter((x) => x.d <= MATCH_RADIUS_KM);
  if (!matches.length) return;

  const sellerIds = Array.from(new Set(matches.map((x) => x.l.sellerId)));
  await prisma.notification.createMany({
    data: sellerIds.map((uid) => ({
      userId: uid,
      type: 'wanted_lead',
      title: 'Someone nearby wants what you sell',
      body: w.title.slice(0, 100),
      data: JSON.stringify({ wantedId: w.id }),
    })),
  });
  await Promise.all(sellerIds.map((uid) => pushToUser(uid, {
    title: '💡 A buyer wants this near you',
    body: w.title.slice(0, 100),
    type: 'wanted_lead',
    data: { wantedId: w.id },
  }).catch(() => {})));
}
