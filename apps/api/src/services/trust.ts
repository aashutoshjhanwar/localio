import { prisma } from '../db/prisma.js';

// Trust score is a weighted 0-100 composite that is visible + explainable.
// Unlike OLX's invisible black box, every input is shown to the user.

export interface TrustBreakdown {
  score: number;          // 0-100
  tier: TrustTier;
  components: {
    kyc:           { value: number; weight: number; label: string };
    responseRate:  { value: number; weight: number; label: string };
    completionRate:{ value: number; weight: number; label: string };
    rating:        { value: number; weight: number; label: string };
    accountAge:    { value: number; weight: number; label: string };
    sellerHistory: { value: number; weight: number; label: string };
    disputes:      { value: number; weight: number; label: string };
  };
  suggestions: string[];  // what the user can do to raise their score
}

export type TrustTier = 'new' | 'rising' | 'trusted' | 'pro' | 'elite';

const WEIGHTS = {
  kyc:            0.20,
  responseRate:   0.20,
  completionRate: 0.15,
  rating:         0.20,
  accountAge:     0.10,
  sellerHistory:  0.10,
  disputes:       0.05,
};

export function tierFromScore(score: number): TrustTier {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'pro';
  if (score >= 50) return 'trusted';
  if (score >= 25) return 'rising';
  return 'new';
}

export async function computeTrust(userId: string): Promise<TrustBreakdown> {
  const [user, ratings, bookings, reports, sold] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, kycVerified: true, phoneVerified: true },
    }),
    prisma.rating.aggregate({
      where: { toId: userId },
      _avg: { stars: true }, _count: true,
    }),
    prisma.booking.findMany({
      where: { providerId: userId },
      select: { status: true, createdAt: true },
    }),
    prisma.report.count({
      where: { targetType: 'user', targetId: userId, status: { in: ['open', 'resolved'] } },
    }),
    prisma.listing.count({ where: { sellerId: userId, status: 'sold' } }),
  ]);

  if (!user) {
    return emptyBreakdown();
  }

  // --- KYC (0..1)
  const kyc = user.kycVerified ? 1 : user.phoneVerified ? 0.4 : 0;

  // --- Response rate: from conversations where I'm a member, did I reply?
  // Proxy: for each conversation I'm in, do I have any outgoing message?
  // Fast approximation: count conversations where I sent at least one message / total.
  const myConvs = await prisma.conversationMember.findMany({
    where: { userId }, select: { conversationId: true }, take: 500,
  });
  let convsReplied = 0;
  if (myConvs.length > 0) {
    const repliedCount = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        senderId: userId,
        conversationId: { in: myConvs.map((c) => c.conversationId) },
      },
    });
    convsReplied = repliedCount.length;
  }
  const responseRate = myConvs.length === 0 ? 0.5 : convsReplied / myConvs.length; // neutral for new users

  // --- Completion rate: of requested bookings, how many completed (not rejected/cancelled)?
  const provBookings = bookings.length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const rejected  = bookings.filter((b) => b.status === 'rejected' || b.status === 'cancelled').length;
  const completionRate = provBookings === 0
    ? 0.5
    : completed / Math.max(1, completed + rejected + Math.max(0, provBookings - completed - rejected));

  // --- Rating (0..1) from 5-star average
  const ratingRaw = ratings._avg.stars ?? 0;
  const ratingConfidence = Math.min(1, ratings._count / 10); // Bayesian-ish prior
  const ratingScore = (ratingRaw / 5) * ratingConfidence + 0.6 * (1 - ratingConfidence); // 0.6 prior

  // --- Account age (0..1) — capped at 365 days = 1.0
  const ageDays = Math.floor((Date.now() - user.createdAt.getTime()) / 86400000);
  const accountAge = Math.min(1, ageDays / 365);

  // --- Seller history (0..1) — log-scaled, capped at 20 sold items
  const sellerHistory = Math.min(1, Math.log2(sold + 1) / Math.log2(21));

  // --- Disputes (0..1) — inverse of report count
  const disputes = Math.max(0, 1 - reports * 0.25); // each open report deducts

  const components = {
    kyc:            { value: kyc,            weight: WEIGHTS.kyc,            label: 'Identity verified' },
    responseRate:   { value: responseRate,   weight: WEIGHTS.responseRate,   label: 'Responds to buyers' },
    completionRate: { value: completionRate, weight: WEIGHTS.completionRate, label: 'Completes bookings' },
    rating:         { value: ratingScore,    weight: WEIGHTS.rating,         label: 'Customer ratings' },
    accountAge:     { value: accountAge,     weight: WEIGHTS.accountAge,     label: 'Time on LOCALIO' },
    sellerHistory:  { value: sellerHistory,  weight: WEIGHTS.sellerHistory,  label: 'Successful sales' },
    disputes:       { value: disputes,       weight: WEIGHTS.disputes,       label: 'Dispute-free' },
  };

  const raw = Object.values(components).reduce((acc, c) => acc + c.value * c.weight, 0);
  const score = Math.round(raw * 100);

  const suggestions: string[] = [];
  if (kyc < 1) suggestions.push('Verify your ID to unlock the KYC badge (+20 points).');
  if (responseRate < 0.7 && myConvs.length >= 3) suggestions.push('Reply to buyers faster — your response rate is low.');
  if (ratings._count < 3) suggestions.push('Ask recent customers for a review.');
  if (sold < 3) suggestions.push('Complete more sales to earn a higher tier.');
  if (reports > 0) suggestions.push('Resolve outstanding reports to remove penalties.');

  return { score, tier: tierFromScore(score), components, suggestions };
}

function emptyBreakdown(): TrustBreakdown {
  return {
    score: 0,
    tier: 'new',
    components: {
      kyc:            { value: 0, weight: WEIGHTS.kyc,            label: 'Identity verified' },
      responseRate:   { value: 0, weight: WEIGHTS.responseRate,   label: 'Responds to buyers' },
      completionRate: { value: 0, weight: WEIGHTS.completionRate, label: 'Completes bookings' },
      rating:         { value: 0, weight: WEIGHTS.rating,         label: 'Customer ratings' },
      accountAge:     { value: 0, weight: WEIGHTS.accountAge,     label: 'Time on LOCALIO' },
      sellerHistory:  { value: 0, weight: WEIGHTS.sellerHistory,  label: 'Successful sales' },
      disputes:       { value: 0, weight: WEIGHTS.disputes,       label: 'Dispute-free' },
    },
    suggestions: [],
  };
}

// Persist score to User.trustScore so it's cheap to read on listing/feed queries.
export async function refreshTrust(userId: string): Promise<TrustBreakdown> {
  const breakdown = await computeTrust(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { trustScore: breakdown.score },
  }).catch(() => {});
  return breakdown;
}
