import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { tierFromScore } from '../services/trust.js';

export const shareRouter = Router();

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? 'https://localio.app';
const APP_DEEPLINK = process.env.APP_DEEPLINK_SCHEME ?? 'localio://';
const PLAY_URL = process.env.PLAY_URL ?? 'https://play.google.com/store/apps/details?id=app.localio';
const APP_STORE_URL = process.env.APP_STORE_URL ?? 'https://apps.apple.com/app/localio/id000000';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}
function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

const TIER_VISUAL: Record<string, { label: string; bg: string; fg: string; icon: string }> = {
  elite:   { label: 'Elite Seller',   bg: '#FFF4D6', fg: '#8A6A00', icon: '◆' },
  pro:     { label: 'Pro Seller',     bg: '#D8F3E2', fg: '#0E7F40', icon: '★' },
  trusted: { label: 'Trusted',        bg: '#DDEBFF', fg: '#1653C5', icon: '✓' },
  rising:  { label: 'Rising',         bg: '#F1EDFF', fg: '#5B3DBF', icon: '↑' },
  new:     { label: 'New Seller',     bg: '#F2EFE8', fg: '#6F6A62', icon: '·' },
};

// --- Public landing page (what WhatsApp / Twitter / iMessage scrape)
shareRouter.get('/l/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { seller: { select: { id: true, name: true, trustScore: true, kycVerified: true } } },
    });
    if (!listing) {
      res.status(404).send(`<!doctype html><html><body><h1>Listing not found</h1></body></html>`);
      return;
    }
    const images: string[] = (() => { try { return JSON.parse(listing.images); } catch { return []; } })();
    const cover = images[0] ?? `${PUBLIC_BASE}/og-default.png`;
    const ogImage = `${PUBLIC_BASE}/api/listings/${id}/og.svg`;
    const title = `${listing.title} · ₹${Math.round(listing.priceInPaise / 100).toLocaleString('en-IN')} on LOCALIO`;
    const desc = truncate(listing.description.replace(/\s+/g, ' '), 180);
    const deepLink = `${APP_DEEPLINK}listing/${id}`;
    const ua = (req.headers['user-agent'] ?? '').toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIos = /iphone|ipad|ipod/.test(ua);

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}">

  <!-- OpenGraph (WhatsApp, FB, LinkedIn, iMessage) -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${PUBLIC_BASE}/l/${id}">
  <meta property="og:site_name" content="LOCALIO">
  <meta property="product:price:amount" content="${listing.priceInPaise / 100}">
  <meta property="product:price:currency" content="INR">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">

  <!-- Deep-link banners -->
  <meta name="apple-itunes-app" content="app-id=000000, app-argument=${escapeHtml(deepLink)}">
  <meta name="google-play-app" content="app-id=app.localio">

  <style>
    :root { --primary: #FF5A3C; --bg: #FAF8F4; --text: #1C1A17; --muted: #6F6A62; }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: var(--bg); color: var(--text); }
    .wrap { max-width: 540px; margin: 0 auto; padding: 16px; }
    .hero { width: 100%; aspect-ratio: 4/3; background: #eee center/cover no-repeat; border-radius: 16px; }
    .price { font-size: 32px; font-weight: 900; margin-top: 16px; }
    .title { font-size: 22px; font-weight: 700; margin: 4px 0 12px; }
    .seller { display: flex; align-items: center; gap: 8px; padding: 12px 0; border-top: 1px solid #E8E4DB; border-bottom: 1px solid #E8E4DB; margin: 12px 0; }
    .badge { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
    .desc { color: var(--text); line-height: 1.5; white-space: pre-wrap; margin-bottom: 24px; }
    .cta { display: block; background: var(--primary); color: #fff; text-align: center; padding: 16px; border-radius: 12px; font-weight: 800; text-decoration: none; font-size: 16px; }
    .cta-sub { display: block; text-align: center; color: var(--muted); padding: 12px; text-decoration: none; }
    .brand { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
    .brand-name { font-weight: 900; color: var(--primary); letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><span class="brand-name">LOCALIO</span><span style="color:var(--muted);font-size:13px">· your neighborhood marketplace</span></div>
    <div class="hero" style="background-image:url('${escapeHtml(cover)}')"></div>
    <div class="price">₹${Math.round(listing.priceInPaise / 100).toLocaleString('en-IN')}${listing.negotiable ? ' <span style="font-size:14px;color:var(--muted);font-weight:600">(negotiable)</span>' : ''}</div>
    <div class="title">${escapeHtml(listing.title)}</div>

    <div class="seller">
      <div style="flex:1">
        <div style="font-weight:700">${escapeHtml(listing.seller?.name ?? 'Seller')}</div>
        ${trustChipHtml(listing.seller?.trustScore ?? 0, listing.seller?.kycVerified ?? false)}
      </div>
    </div>

    <p class="desc">${escapeHtml(listing.description)}</p>

    <a class="cta" href="${escapeHtml(deepLink)}">Open in LOCALIO</a>
    <a class="cta-sub" href="${isAndroid ? PLAY_URL : isIos ? APP_STORE_URL : PUBLIC_BASE}">Don't have the app? Get LOCALIO →</a>
  </div>

  <script>
    // Try the deep link, fall back to store after 1.2s if it fails (no app installed).
    (function () {
      try {
        var dl = ${JSON.stringify(deepLink)};
        var fallback = ${JSON.stringify(isAndroid ? PLAY_URL : isIos ? APP_STORE_URL : '')};
        if (!fallback) return;
        var t = setTimeout(function () { window.location.href = fallback; }, 1200);
        window.addEventListener('blur', function () { clearTimeout(t); });
        window.location.href = dl;
      } catch (e) { /* noop */ }
    })();
  </script>
</body>
</html>`);
  } catch (e) { next(e); }
});

// --- Dynamic OG image (1200x630 SVG)
shareRouter.get('/api/listings/:id/og.svg', async (req, res, next) => {
  try {
    const id = req.params.id;
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { seller: { select: { name: true, trustScore: true, kycVerified: true } } },
    });
    if (!listing) return res.status(404).end();

    const price = `₹${Math.round(listing.priceInPaise / 100).toLocaleString('en-IN')}`;
    const title = truncate(listing.title, 50);
    const sellerName = listing.seller?.name ?? 'Seller';
    const tier = TIER_VISUAL[tierFromScore(listing.seller?.trustScore ?? 0)];

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FAF8F4"/>
      <stop offset="1" stop-color="#FFEDE7"/>
    </linearGradient>
    <linearGradient id="cardEdge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F2EFE8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Brand strip -->
  <text x="64" y="86" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="34" font-weight="900" fill="#FF5A3C" letter-spacing="2">LOCALIO</text>
  <text x="240" y="86" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="22" fill="#6F6A62">your neighborhood marketplace</text>

  <!-- Card -->
  <rect x="64" y="130" width="1072" height="430" rx="28" fill="url(#cardEdge)" stroke="#E8E4DB" stroke-width="1.5"/>

  <!-- Price banner -->
  <rect x="96" y="170" width="500" height="90" rx="20" fill="#FF5A3C"/>
  <text x="120" y="232" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="62" font-weight="900" fill="#FFFFFF">${escapeXml(price)}</text>
  ${listing.negotiable ? `<text x="120" y="288" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="22" fill="#8A6A00">(negotiable)</text>` : ''}

  <!-- Title -->
  <text x="96" y="370" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="48" font-weight="800" fill="#1C1A17">${escapeXml(title)}</text>

  <!-- Seller row -->
  <circle cx="120" cy="465" r="32" fill="#FFEDE7" stroke="#FF5A3C" stroke-width="2"/>
  <text x="120" y="476" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="28" font-weight="800" text-anchor="middle" fill="#FF5A3C">${escapeXml((sellerName[0] ?? '?').toUpperCase())}</text>
  <text x="172" y="458" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#1C1A17">${escapeXml(truncate(sellerName, 28))}</text>

  <!-- Trust badge -->
  <rect x="172" y="476" width="${100 + tier.label.length * 11}" height="34" rx="17" fill="${tier.bg}"/>
  <text x="190" y="500" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="18" font-weight="800" fill="${tier.fg}">${tier.icon} ${escapeXml(tier.label)}</text>

  ${listing.seller?.kycVerified ? `
  <rect x="${180 + tier.label.length * 11 + 100}" y="476" width="120" height="34" rx="17" fill="#E0F7F1"/>
  <text x="${198 + tier.label.length * 11 + 100}" y="500" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="18" font-weight="800" fill="#0B7A5E">🛡 KYC verified</text>
  ` : ''}

  <!-- Footer CTA -->
  <text x="1136" y="525" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" text-anchor="end" fill="#FF5A3C">Tap to chat on LOCALIO →</text>
</svg>`;

    res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=300, s-maxage=600');
    res.send(svg);
  } catch (e) { next(e); }
});

function trustChipHtml(score: number, kyc: boolean): string {
  const tier = TIER_VISUAL[tierFromScore(score)];
  return `<span class="badge" style="background:${tier.bg};color:${tier.fg}">${tier.icon} ${tier.label}</span>${kyc ? ' <span class="badge" style="background:#E0F7F1;color:#0B7A5E">🛡 KYC</span>' : ''}`;
}
