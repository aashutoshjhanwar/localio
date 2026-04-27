import { prisma } from '../db/prisma.js';

// Real-time seller coach. Unlike OLX which accepts anything, we grade every listing
// on its way in and tell the seller exactly what would make it rank higher.

export interface QualityIssue {
  field: string;           // 'images' | 'description' | 'price' | 'title' | 'attributes'
  severity: 'info' | 'warn' | 'blocker';
  message: string;         // user-facing tip
  pointsLost: number;      // 0..100 contribution
}

export interface QualityReport {
  score: number;           // 0..100
  grade: 'A' | 'B' | 'C' | 'D';
  issues: QualityIssue[];
  priceSuggestion?: { lowPaise: number; medianPaise: number; highPaise: number; sample: number };
  canPublish: boolean;     // false if any 'blocker'
}

// Minimum description length by category — buyers expect more detail for electronics than for clothes.
const MIN_DESC_LEN: Record<string, number> = {
  electronics: 80,
  mobile: 80,
  laptop: 100,
  vehicle: 120,
  bike: 120,
  car: 150,
  property: 200,
  furniture: 60,
  home: 60,
  default: 50,
};

// Required attributes keys by category — missing these drops the score.
const REQUIRED_ATTRS: Record<string, string[]> = {
  mobile:   ['brand', 'model', 'ageMonths', 'condition'],
  laptop:   ['brand', 'model', 'ageMonths', 'condition'],
  bike:     ['brand', 'model', 'year', 'kmDriven'],
  car:      ['brand', 'model', 'year', 'kmDriven', 'fuel'],
  property: ['bhk', 'furnishing', 'carpetArea'],
};

export async function gradeListing(input: {
  title: string;
  description: string;
  category: string;
  priceInPaise: number;
  images: string[];
  attributes?: Record<string, unknown> | null;
  lat: number;
  lng: number;
}): Promise<QualityReport> {
  const issues: QualityIssue[] = [];
  let score = 100;

  // --- Title quality
  const titleLen = input.title.trim().length;
  if (titleLen < 8) {
    issues.push({ field: 'title', severity: 'blocker', message: 'Title is too short — add brand/model.', pointsLost: 15 });
    score -= 15;
  } else if (titleLen < 20) {
    issues.push({ field: 'title', severity: 'warn', message: 'A longer title ranks higher. Include brand, model, year.', pointsLost: 5 });
    score -= 5;
  }
  if (/[A-Z]{4,}/.test(input.title) && input.title === input.title.toUpperCase()) {
    issues.push({ field: 'title', severity: 'info', message: 'ALL CAPS titles feel spammy — switch to title case.', pointsLost: 3 });
    score -= 3;
  }

  // --- Description
  const minDesc = MIN_DESC_LEN[input.category] ?? MIN_DESC_LEN.default;
  const descLen = input.description.trim().length;
  if (descLen < minDesc / 2) {
    issues.push({ field: 'description', severity: 'blocker', message: `Description is too short. Write at least ${minDesc} characters.`, pointsLost: 20 });
    score -= 20;
  } else if (descLen < minDesc) {
    issues.push({ field: 'description', severity: 'warn', message: `Add more detail — buyers want at least ${minDesc} characters.`, pointsLost: 10 });
    score -= 10;
  }

  // --- Images
  const photoCount = input.images.length;
  if (photoCount === 0) {
    issues.push({ field: 'images', severity: 'blocker', message: 'Add at least one clear photo.', pointsLost: 25 });
    score -= 25;
  } else if (photoCount === 1) {
    issues.push({ field: 'images', severity: 'warn', message: 'Listings with 3+ photos get 2x more chats.', pointsLost: 10 });
    score -= 10;
  } else if (photoCount === 2) {
    issues.push({ field: 'images', severity: 'info', message: 'One more angle would help buyers decide faster.', pointsLost: 3 });
    score -= 3;
  }

  // --- Required attributes
  const required = REQUIRED_ATTRS[input.category] ?? [];
  const attrs = (input.attributes ?? {}) as Record<string, unknown>;
  const missing = required.filter((k) => attrs[k] === undefined || attrs[k] === null || attrs[k] === '');
  if (missing.length > 0) {
    issues.push({
      field: 'attributes',
      severity: 'warn',
      message: `Add these details: ${missing.join(', ')}.`,
      pointsLost: missing.length * 4,
    });
    score -= missing.length * 4;
  }

  // --- Price reality check against local comps
  const priceSuggestion = await computePriceBand(input.category, input.lat, input.lng);
  if (priceSuggestion) {
    const { lowPaise, highPaise } = priceSuggestion;
    if (input.priceInPaise > highPaise * 1.5) {
      issues.push({ field: 'price', severity: 'warn', message: `Price is high vs similar listings nearby (₹${fmt(lowPaise)}–₹${fmt(highPaise)}).`, pointsLost: 8 });
      score -= 8;
    } else if (input.priceInPaise < lowPaise * 0.5) {
      issues.push({ field: 'price', severity: 'warn', message: `Price seems too low vs nearby (₹${fmt(lowPaise)}–₹${fmt(highPaise)}). Buyers may suspect a scam.`, pointsLost: 6 });
      score -= 6;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const grade: QualityReport['grade'] = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  const canPublish = !issues.some((i) => i.severity === 'blocker');

  return { score, grade, issues, priceSuggestion, canPublish };
}

function fmt(paise: number): string {
  return Math.round(paise / 100).toLocaleString('en-IN');
}

// Sample recent active listings in the same category within ~20 km to form a price band.
async function computePriceBand(category: string, lat: number, lng: number) {
  const lookback = new Date(Date.now() - 60 * 86400_000);
  // Pull a wider net; we'll filter client-side to nearby via geohash lat/lng proximity.
  const comps = await prisma.listing.findMany({
    where: { category, status: 'active', createdAt: { gt: lookback } },
    select: { priceInPaise: true, lat: true, lng: true },
    take: 400,
  });
  const nearby = comps
    .filter((c) => c.priceInPaise > 0)
    .filter((c) => Math.abs(c.lat - lat) < 0.3 && Math.abs(c.lng - lng) < 0.3) // ~30 km bounding box
    .map((c) => c.priceInPaise)
    .sort((a, b) => a - b);

  if (nearby.length < 5) return undefined;
  const pct = (p: number) => nearby[Math.max(0, Math.min(nearby.length - 1, Math.floor((nearby.length - 1) * p)))];
  return {
    lowPaise: pct(0.25),
    medianPaise: pct(0.5),
    highPaise: pct(0.75),
    sample: nearby.length,
  };
}
