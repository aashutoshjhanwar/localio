// Scam Shield — rule-based text classifier tuned for India P2P marketplace scams.
// Scans both incoming chat messages and listing descriptions. Low false positive rate
// is critical; we prefer missing some over crying wolf.

export type ScamSeverity = 'low' | 'medium' | 'high';

export interface ScamFlag {
  kind: string;         // bucket, e.g. 'advance_payment', 'off_platform', 'phone_harvest'
  severity: ScamSeverity;
  reason: string;       // one-line user-facing explanation
  excerpt?: string;     // the matched text slice
}

export interface ScamAssessment {
  risk: 'clean' | 'low' | 'medium' | 'high';
  flags: ScamFlag[];
  advice?: string;      // user-facing, short
}

interface Rule {
  kind: string;
  severity: ScamSeverity;
  reason: string;
  pattern: RegExp;
}

// NB: patterns use non-capturing groups + word boundaries where possible.
// Tested against common scam templates seen on OLX/WhatsApp groups.
const RULES: Rule[] = [
  // Advance payment scams ("send ₹X first", "pay first then I ship")
  {
    kind: 'advance_payment',
    severity: 'high',
    reason: 'Asks for payment before you see the item',
    pattern: /\b(advance|token|pay(?:ment)?\s*(?:first|upfront|in\s*advance)|send\s+(?:money|upi|gpay|paytm)\s+(?:first|now)|book(?:ing)?\s+(?:fee|amount))\b/i,
  },
  // UPI / bank push without meeting
  {
    kind: 'upi_push',
    severity: 'medium',
    reason: 'Pressure to pay by UPI/bank before meeting',
    pattern: /\b(scan\s+this\s+qr|pay\s+on\s+upi|send\s+upi|ifsc|account\s+number|my\s+upi\s+id)\b/i,
  },
  // Fake courier / shipping (very common on OLX)
  {
    kind: 'courier_scam',
    severity: 'high',
    reason: 'Classic courier / shipping scam pattern',
    pattern: /\b(courier|delivery\s+charges?|shipping\s+charges?|army|defense|defence|csd|transfer\s+posting|i\s+will\s+ship|railway\s+parcel)\b/i,
  },
  // Off-platform moves
  {
    kind: 'off_platform',
    severity: 'medium',
    reason: 'Pushing the conversation off LOCALIO — scammers do this to dodge our protection',
    pattern: /\b(whats?app|telegram|signal|add\s+me\s+on|dm\s+me|contact\s+on|text\s+me\s+on)\s*(?:\+?\d|[0-9])/i,
  },
  // Phone / OTP harvesting
  {
    kind: 'otp_harvest',
    severity: 'high',
    reason: 'Asking for an OTP is ALWAYS a scam',
    pattern: /\b(share\s+(?:\w+\s+){0,2}otp|send\s+(?:me\s+)?(?:the\s+|your\s+)?otp|(?:the\s+)?otp\s+(?:code|number)|6[\s-]*digit\s+code|verification\s+code)\b/i,
  },
  // Overpayment / "I'll send extra"
  {
    kind: 'overpayment',
    severity: 'high',
    reason: 'Overpayment is a refund-scam setup',
    pattern: /\b(extra\s+amount|more\s+than\s+(?:asking|the\s+price)|overpay|refund\s+(?:the\s+)?difference)\b/i,
  },
  // Impersonation of support / bank
  {
    kind: 'impersonation',
    severity: 'high',
    reason: 'Mentions LOCALIO support / bank — we will NEVER DM you',
    pattern: /\b(localio\s+(?:support|team|staff)|bank\s+representative|kyc\s+update\s+link)\b/i,
  },
  // Too-good-to-be-true pricing
  {
    kind: 'too_cheap',
    severity: 'low',
    reason: 'Price looks unusually low for this item',
    pattern: /^/, // handled separately in fairPrice checks
  },
];

const ADVICE_BY_KIND: Record<string, string> = {
  advance_payment: 'Never pay before you see the item in person. Meet at a safe public spot.',
  upi_push:        'Pay only after inspection. Scammers rush payments.',
  courier_scam:    'LOCALIO does not ship between strangers. This is a known OLX scam.',
  off_platform:    'Keep the chat on LOCALIO — outside, we cannot help if anything goes wrong.',
  otp_harvest:     'Never share an OTP with anyone, including LOCALIO. Block and report.',
  overpayment:     'Do not accept payments larger than the price. It is a refund scam.',
  impersonation:   'LOCALIO will never ask for payment or KYC via chat. Report this user.',
};

export function assess(text: string): ScamAssessment {
  if (!text || text.length < 3) return { risk: 'clean', flags: [] };
  const flags: ScamFlag[] = [];

  for (const rule of RULES) {
    if (rule.kind === 'too_cheap') continue; // context-dependent
    const m = rule.pattern.exec(text);
    if (m) {
      flags.push({
        kind: rule.kind,
        severity: rule.severity,
        reason: rule.reason,
        excerpt: m[0]?.slice(0, 80),
      });
    }
  }

  // Risk aggregation: take the max severity among unique kinds.
  const order = { low: 1, medium: 2, high: 3 } as const;
  let maxSev: ScamSeverity | null = null;
  for (const f of flags) {
    if (!maxSev || order[f.severity] > order[maxSev]) maxSev = f.severity;
  }

  const risk: ScamAssessment['risk'] = !maxSev ? 'clean' : maxSev;
  const advice = flags[0] ? ADVICE_BY_KIND[flags[0].kind] : undefined;

  return { risk, flags, advice };
}

// Used by listing create to flag suspiciously-low price relative to comps.
export function assessPrice(opts: {
  priceInPaise: number;
  comparables: number[]; // comp prices in paise
}): ScamFlag | null {
  const { priceInPaise, comparables } = opts;
  if (comparables.length < 3) return null;
  const sorted = [...comparables].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (priceInPaise < median * 0.4) {
    return {
      kind: 'too_cheap',
      severity: 'medium',
      reason: `Price is more than 60% below the typical ₹${Math.round(median / 100)}. Double-check before buying.`,
    };
  }
  return null;
}
