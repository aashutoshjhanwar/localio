import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share, FlatList,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import { ReportModal } from '../components/ReportModal';
import { ImageCarousel } from '../components/ImageCarousel';
import { TrustBadge } from '../components/TrustBadge';
import { formatLastActive, formatResponseTime } from '../utils/trustSignals';
import { OfferModal } from '../components/OfferModal';
import { OfferCard } from '../components/OfferCard';
import { MarkSoldModal } from '../components/MarkSoldModal';
import { RateModal } from '../components/RateModal';
import { CounterOfferModal } from '../components/CounterOfferModal';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'ListingDetail'>;
type N = NativeStackNavigationProp<RootStackParamList, 'ListingDetail'>;

export function ListingDetailScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<N>();
  const me = useAuth((s) => s.user);
  const [listing, setListing] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [soldOpen, setSoldOpen] = useState(false);
  const [rateBuyerOpen, setRateBuyerOpen] = useState(false);
  const [rateBuyer, setRateBuyer] = useState<{ id: string; name: string | null } | null>(null);
  const [rateSellerOpen, setRateSellerOpen] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [myOffer, setMyOffer] = useState<any | null>(null);
  const [counterFor, setCounterFor] = useState<any | null>(null);
  const [stats, setStats] = useState<{ views: number; favorites: number; offers: number; pendingOffers: number; chats: number } | null>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<Array<{ id: string; oldPriceInPaise: number; newPriceInPaise: number; changedAt: string }>>([]);
  const [sellerStats, setSellerStats] = useState<any | null>(null);

  const loadOffersForSeller = async (listingId: string) => {
    try { const r = await Api.listingOffers(listingId); setOffers(r.offers); } catch {}
  };
  const loadMyOffer = async (listingId: string) => {
    try {
      const r = await Api.myOffers();
      const mine = r.offers.find((o: any) => o.listingId === listingId);
      setMyOffer(mine ?? null);
    } catch {}
  };

  useEffect(() => {
    Api.listing(params.id).then((r) => {
      setListing(r.listing);
      if (me?.id === r.listing.sellerId) {
        loadOffersForSeller(r.listing.id);
        Api.listingStats(r.listing.id).then((s) => setStats(s.stats)).catch(() => {});
      } else {
        loadMyOffer(r.listing.id);
        Api.user(r.listing.sellerId).then((u) => setSellerStats(u.user?.stats ?? null)).catch(() => {});
      }
    }).catch(() => {});
    Api.favorites().then((r) => setSaved(r.favorites.some((f) => f.id === params.id))).catch(() => {});
    Api.similarListings(params.id).then((r) => setSimilar(r.listings)).catch(() => {});
    Api.priceHistory(params.id).then((r) => setPriceHistory(r.history)).catch(() => {});
  }, [params.id, me?.id]);

  if (!listing) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  const isOwner = me?.id === listing.sellerId;

  async function chatWithSeller() {
    try {
      const { conversation } = await Api.directChat(listing.sellerId, listing.id);
      nav.navigate('ChatRoom', { conversationId: conversation.id, title: listing.seller?.name ?? 'Seller' });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not start chat');
    }
  }

  async function shareListing() {
    try {
      const priceStr = `₹${(listing.priceInPaise / 100).toLocaleString('en-IN')}`;
      await Share.share({
        message: `${listing.title} — ${priceStr}\n${listing.description}\n\nSee on LOCALIO: localio://listing/${listing.id}`,
      });
    } catch { /* noop */ }
  }

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    try {
      if (next) await Api.favorite(listing.id);
      else await Api.unfavorite(listing.id);
    } catch (e: any) {
      setSaved(!next);
      Alert.alert('Error', e.message ?? 'could not update');
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ImageCarousel images={listing.images ?? []} />

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleSave}>
          <Text style={{ fontSize: 22, color: saved ? theme.colors.primary : theme.colors.textMuted }}>
            {saved ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={shareListing}>
          <Text style={{ fontSize: 18 }}>↗</Text>
        </TouchableOpacity>
        {!isOwner && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setReportOpen(true)}>
            <Text style={{ fontSize: 18 }}>🚩</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ padding: 16, paddingTop: 0 }}>
        {listing.featured && <Text style={styles.featuredPill}>🚀 BOOSTED</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={styles.price}>₹{(listing.priceInPaise / 100).toLocaleString('en-IN')}</Text>
          {listing.recentlyReduced && listing.previousPriceInPaise && (
            <>
              <Text style={styles.oldPrice}>₹{(listing.previousPriceInPaise / 100).toLocaleString('en-IN')}</Text>
              <Text style={styles.reducedPill}>↓ REDUCED</Text>
            </>
          )}
          {listing.negotiable && <Text style={styles.neg}>  • negotiable</Text>}
        </View>
        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.meta}>{listing.category} · {listing.views ?? 0} views</Text>
        <View style={styles.divider} />
        {listing.attributes && Object.keys(listing.attributes).length > 0 && (
          <>
            <Text style={styles.section}>Details</Text>
            <View style={styles.attrGrid}>
              {Object.entries(listing.attributes as Record<string, any>).map(([k, v]) => (
                <View key={k} style={styles.attrCell}>
                  <Text style={styles.attrCellLabel}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</Text>
                  <Text style={styles.attrCellValue}>{String(v)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.divider} />
          </>
        )}
        <Text style={styles.section}>Description</Text>
        <Text style={styles.desc}>{listing.description}</Text>
        <View style={styles.divider} />
        <Text style={styles.section}>Seller</Text>
        <TouchableOpacity style={styles.sellerRow} onPress={() => nav.navigate('UserProfile', { id: listing.sellerId })}>
          {listing.seller?.avatarUrl ? (
            <Image source={{ uri: listing.seller.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}><Text style={{ fontSize: 20 }}>👤</Text></View>
          )}
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.sellerName}>{listing.seller?.name ?? 'User'}</Text>
            <View style={{ marginTop: 4 }}>
              <TrustBadge score={listing.seller?.trustScore} kycVerified={listing.seller?.kycVerified} />
            </View>
            {sellerStats && (
              <View style={styles.sellerSignals}>
                {typeof sellerStats.listingsSold === 'number' && sellerStats.listingsSold > 0 && (
                  <Text style={styles.sellerSignalPill}>✓ Sold {sellerStats.listingsSold}</Text>
                )}
                {formatResponseTime(sellerStats.avgResponseMins) && (
                  <Text style={styles.sellerSignalPill}>💬 {formatResponseTime(sellerStats.avgResponseMins)}</Text>
                )}
                {formatLastActive(sellerStats.lastActiveAt) && (
                  <Text style={styles.sellerSignalPill}>🟢 {formatLastActive(sellerStats.lastActiveAt)}</Text>
                )}
              </View>
            )}
          </View>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </TouchableOpacity>
      </View>

      {isOwner && listing.status === 'active' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity style={styles.soldBtn} onPress={() => setSoldOpen(true)}>
            <Text style={styles.soldBtnText}>✅ Mark as sold</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dupeBtn, { marginTop: 10 }]}
            onPress={async () => {
              try {
                const r = await Api.reserveListing(listing.id);
                setListing(r.listing);
              } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
            }}
          >
            <Text style={styles.dupeBtnText}>🔖 Mark as reserved</Text>
          </TouchableOpacity>
        </View>
      )}

      {listing.status === 'reserved' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={styles.reservedCard}>
            <Text style={styles.reservedTitle}>🔖 Reserved</Text>
            <Text style={styles.reservedSub}>
              {isOwner ? 'You set this on hold. Other buyers see it as reserved.' : 'The seller is currently holding this for another buyer.'}
            </Text>
          </View>
          {isOwner && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.relistBtn, { flex: 1 }]}
                onPress={async () => {
                  try {
                    const r = await Api.unreserveListing(listing.id);
                    setListing(r.listing);
                  } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
                }}
              >
                <Text style={styles.relistBtnText}>↩ Release</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.soldBtn, { flex: 1, marginTop: 0 }]} onPress={() => setSoldOpen(true)}>
                <Text style={styles.soldBtnText}>✅ Mark as sold</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {isOwner && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity
            style={styles.dupeBtn}
            onPress={() => nav.navigate('CreateListing', { dupeFromId: listing.id })}
          >
            <Text style={styles.dupeBtnText}>📋 Post similar</Text>
          </TouchableOpacity>
        </View>
      )}

      {listing.status === 'sold' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={styles.soldCard}>
            <Text style={styles.soldTitle}>Sold</Text>
            <Text style={styles.soldSub}>
              {listing.soldAt ? `on ${new Date(listing.soldAt).toLocaleDateString('en-IN')}` : ''}
            </Text>
          </View>
          {!isOwner && me?.id === listing.soldToId && (
            <TouchableOpacity style={[styles.soldBtn, { marginTop: 10 }]} onPress={() => setRateSellerOpen(true)}>
              <Text style={styles.soldBtnText}>⭐ Rate the seller</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity
              style={[styles.relistBtn, { marginTop: 10 }]}
              onPress={async () => {
                try {
                  const r = await Api.relistListing(listing.id);
                  setListing(r.listing);
                  Alert.alert('Relisted', 'Your item is back in the feed.');
                } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
              }}
            >
              <Text style={styles.relistBtnText}>♻️ Relist this item</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isOwner && listing.status === 'closed' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={[styles.soldCard, { borderColor: theme.colors.textMuted }]}>
            <Text style={[styles.soldTitle, { color: theme.colors.textMuted }]}>Closed</Text>
            <Text style={styles.soldSub}>You took this listing down. Relist it to put it back in the feed.</Text>
          </View>
          <TouchableOpacity
            style={[styles.relistBtn, { marginTop: 10 }]}
            onPress={async () => {
              try {
                const r = await Api.relistListing(listing.id);
                setListing(r.listing);
                Alert.alert('Relisted', 'Your item is back in the feed.');
              } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
            }}
          >
            <Text style={styles.relistBtnText}>♻️ Relist this item</Text>
          </TouchableOpacity>
        </View>
      )}

      {isOwner && listing.status === 'active' && (() => {
        const last = listing.bumpedAt ? new Date(listing.bumpedAt).getTime() : 0;
        const cooldownMs = 24 * 3600 * 1000;
        const remainingMs = Math.max(0, last + cooldownMs - Date.now());
        const hoursLeft = Math.ceil(remainingMs / 3600 / 1000);
        return (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TouchableOpacity
              style={[styles.bumpBtn, remainingMs > 0 && styles.bumpBtnDisabled]}
              disabled={remainingMs > 0}
              onPress={async () => {
                try {
                  const r = await Api.bumpListing(listing.id);
                  setListing(r.listing);
                  Alert.alert('Bumped', 'Your listing is back on top of the feed.');
                } catch (e: any) {
                  if (e.code === 'cooldown') Alert.alert('Come back soon', 'You can bump this listing again in a few hours.');
                  else Alert.alert('Error', e.message ?? 'try again');
                }
              }}
            >
              <Text style={[styles.bumpBtnText, remainingMs > 0 && { color: theme.colors.textMuted }]}>
                {remainingMs > 0 ? `⏱ Bump available in ${hoursLeft}h` : '⬆ Bump to top (free, 1×/day)'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {isOwner && listing.status === 'active' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {listing.featured && listing.featuredUntil ? (
            <View style={styles.boostCard}>
              <Text style={styles.boostTitle}>🚀 Boosted</Text>
              <Text style={styles.boostSub}>
                Top of feed until {new Date(listing.featuredUntil).toLocaleString('en-IN')}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.boostBtn}
              onPress={async () => {
                try {
                  const r = await Api.boostListing(listing.id, 24);
                  setListing(r.listing);
                  Alert.alert('Boosted', 'Your listing is pinned to the top for 24 hours.');
                } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
              }}
            >
              <Text style={styles.boostBtnText}>🚀 Boost for 24h</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isOwner && stats && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <Text style={styles.section}>📊 Performance</Text>
          <View style={styles.statsRow}>
            <StatTile label="Views" value={stats.views} />
            <StatTile label="Saves" value={stats.favorites} />
            <StatTile label="Chats" value={stats.chats} />
          </View>
          <View style={[styles.statsRow, { marginTop: 8 }]}>
            <StatTile label="Offers" value={stats.offers} />
            <StatTile label="Pending" value={stats.pendingOffers} accent />
            <View style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {isOwner && offers.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={styles.section}>Offers ({offers.length})</Text>
          {offers.map((o) => (
            <View key={o.id} style={{ marginBottom: 10 }}>
              <OfferCard
                amountInPaise={o.amountInPaise}
                status={o.status}
                mine={false}
                counterAmountPaise={o.counterAmountPaise}
                counterMessage={o.counterMessage}
                onAccept={async () => {
                  try { await Api.acceptOffer(o.id); await loadOffersForSeller(listing.id); }
                  catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
                }}
                onDecline={async () => {
                  try { await Api.declineOffer(o.id); await loadOffersForSeller(listing.id); }
                  catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
                }}
                onCounter={() => setCounterFor(o)}
              />
              <Text style={styles.offerBy}>
                from {o.buyer?.name ?? 'Neighbor'} · {new Date(o.createdAt).toLocaleString('en-IN')}
              </Text>
              {o.message ? <Text style={styles.offerMsg}>"{o.message}"</Text> : null}
            </View>
          ))}
        </View>
      )}

      {!isOwner && myOffer && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={styles.section}>Your offer</Text>
          <OfferCard
            amountInPaise={myOffer.amountInPaise}
            status={myOffer.status}
            mine
            counterAmountPaise={myOffer.counterAmountPaise}
            counterMessage={myOffer.counterMessage}
            onAcceptCounter={async () => {
              try { await Api.acceptCounter(myOffer.id); await loadMyOffer(listing.id); }
              catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
            }}
            onWithdraw={
              (myOffer.status === 'pending' || myOffer.status === 'countered')
                ? async () => {
                    try { await Api.withdrawOffer(myOffer.id); await loadMyOffer(listing.id); }
                    catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
                  }
                : undefined
            }
          />
        </View>
      )}

      {!isOwner && (
        <View style={styles.ctaBar}>
          {listing.negotiable && (!myOffer || (myOffer.status !== 'pending' && myOffer.status !== 'countered')) && (
            <TouchableOpacity style={[styles.cta, styles.ctaSecondary]} onPress={() => setOfferOpen(true)}>
              <Text style={[styles.ctaText, { color: theme.colors.primary }]}>💸 Make an offer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cta} onPress={chatWithSeller}>
            <Text style={styles.ctaText}>💬 Chat with seller</Text>
          </TouchableOpacity>
        </View>
      )}

      {priceHistory.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text style={styles.section}>📉 Price history</Text>
          {priceHistory.slice(0, 5).map((h) => {
            const dropped = h.newPriceInPaise < h.oldPriceInPaise;
            return (
              <View key={h.id} style={styles.historyRow}>
                <Text style={styles.historyArrow}>{dropped ? '↓' : '↑'}</Text>
                <Text style={styles.historyText}>
                  ₹{(h.oldPriceInPaise / 100).toLocaleString('en-IN')}
                  <Text style={styles.historyArrowInline}>  →  </Text>
                  ₹{(h.newPriceInPaise / 100).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.historyDate}>{new Date(h.changedAt).toLocaleDateString('en-IN')}</Text>
              </View>
            );
          })}
        </View>
      )}

      {similar.length > 0 && (
        <View style={{ paddingTop: 8, paddingBottom: 24 }}>
          <Text style={[styles.section, { paddingHorizontal: 16 }]}>You might also like</Text>
          <FlatList
            data={similar}
            keyExtractor={(s) => s.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.simCard}
                onPress={() => nav.push('ListingDetail', { id: item.id })}
              >
                {item.images?.[0] ? (
                  <Image source={{ uri: item.images[0] }} style={styles.simImg} />
                ) : (
                  <View style={[styles.simImg, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 28 }}>🛒</Text>
                  </View>
                )}
                <Text style={styles.simPrice}>₹{(item.priceInPaise / 100).toLocaleString('en-IN')}</Text>
                <Text numberOfLines={2} style={styles.simTitle}>{item.title}</Text>
                {typeof item.distanceKm === 'number' && (
                  <Text style={styles.simMeta}>{item.distanceKm.toFixed(1)} km away</Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <MarkSoldModal
        visible={soldOpen}
        onClose={() => setSoldOpen(false)}
        listingId={listing.id}
        onMarked={(buyer) => {
          setListing({ ...listing, status: 'sold', soldToId: buyer?.id ?? null, soldAt: new Date().toISOString() });
          if (buyer) {
            setRateBuyer(buyer);
            setTimeout(() => setRateBuyerOpen(true), 300);
          }
        }}
      />
      {rateBuyer && (
        <RateModal
          visible={rateBuyerOpen}
          onClose={() => setRateBuyerOpen(false)}
          toId={rateBuyer.id}
          context="listing"
          contextId={listing.id}
          title={`Rate ${rateBuyer.name ?? 'the buyer'}`}
        />
      )}
      <RateModal
        visible={rateSellerOpen}
        onClose={() => setRateSellerOpen(false)}
        toId={listing.sellerId}
        context="listing"
        contextId={listing.id}
        title={`Rate ${listing.seller?.name ?? 'the seller'}`}
      />
      <OfferModal
        visible={offerOpen}
        onClose={() => setOfferOpen(false)}
        listingId={listing.id}
        listingTitle={listing.title}
        askingPriceInPaise={listing.priceInPaise}
        onSent={() => loadMyOffer(listing.id)}
      />
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={listing.id}
      />
      <CounterOfferModal
        visible={!!counterFor}
        onClose={() => setCounterFor(null)}
        offerId={counterFor?.id ?? null}
        buyerName={counterFor?.buyer?.name ?? 'Buyer'}
        buyerOfferPaise={counterFor?.amountInPaise ?? 0}
        askingPricePaise={listing.priceInPaise}
        onSent={() => loadOffersForSeller(listing.id)}
      />
    </ScrollView>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={[statStyles.tile, accent && statStyles.tileAccent]}>
      <Text style={[statStyles.val, accent && { color: theme.colors.primaryDark }]}>{value}</Text>
      <Text style={[statStyles.lab, accent && { color: theme.colors.primaryDark }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  tile: {
    flex: 1, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    paddingVertical: 14, alignItems: 'center', marginRight: 8,
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm,
  },
  tileAccent: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  val: { fontSize: 22, fontWeight: '900', color: theme.colors.text },
  lab: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted, marginTop: 2, letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row' },
  hero: { width: '100%', height: 260, backgroundColor: '#EEE' },
  heroPh: { justifyContent: 'center', alignItems: 'center' },
  actionBar: { flexDirection: 'row', justifyContent: 'flex-end', padding: 8, gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  price: { fontSize: 28, fontWeight: '900', color: theme.colors.primary },
  neg: { fontSize: 14, fontWeight: '500', color: theme.colors.textMuted },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginTop: 6 },
  meta: { color: theme.colors.textMuted, marginTop: 4 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  section: { fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  attrGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  attrCell: {
    width: '50%', paddingHorizontal: 4, paddingVertical: 6,
  },
  attrCellLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase' },
  attrCellValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 2 },
  desc: { color: theme.colors.text, lineHeight: 22 },
  sellerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  sellerName: { fontWeight: '700', color: theme.colors.text },
  sellerSignals: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  sellerSignalPill: {
    backgroundColor: theme.colors.primarySoft, color: theme.colors.primaryDark,
    fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, overflow: 'hidden',
  },
  verified: { color: theme.colors.success, fontSize: 12, marginTop: 2 },
  ctaBar: { padding: 16, gap: 10 },
  cta: { backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  ctaSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  offerBy: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  offerMsg: { color: theme.colors.text, fontStyle: 'italic', marginTop: 2 },
  ghostBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingVertical: 10, alignItems: 'center' },
  ghostBtnText: { color: theme.colors.textMuted, fontWeight: '700' },
  bumpBtn: {
    backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radius.md,
    alignItems: 'center', ...theme.shadow.sm,
  },
  bumpBtnDisabled: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  bumpBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  boostBtn: { backgroundColor: theme.colors.accent ?? '#F5A623', paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  boostBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  boostCard: { borderWidth: 1, borderColor: theme.colors.accent ?? '#F5A623', borderRadius: theme.radius.md, padding: 12 },
  boostTitle: { color: theme.colors.accent ?? '#F5A623', fontWeight: '800', fontSize: 15 },
  boostSub: { color: theme.colors.textMuted, marginTop: 4, fontSize: 12 },
  featuredPill: { alignSelf: 'flex-start', backgroundColor: theme.colors.accent ?? '#F5A623', color: '#fff', fontWeight: '800', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  soldBtn: { backgroundColor: theme.colors.success, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  soldBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  soldCard: { borderWidth: 1, borderColor: theme.colors.success, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.surface },
  relistBtn: {
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.primary,
    borderRadius: theme.radius.lg, paddingVertical: 14, alignItems: 'center', ...theme.shadow.sm,
  },
  relistBtnText: { color: theme.colors.primary, fontWeight: '800', fontSize: 15 },
  dupeBtn: {
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, paddingVertical: 12, alignItems: 'center',
  },
  dupeBtnText: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
  simCard: {
    width: 150, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: 8, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm,
  },
  simImg: { width: '100%', height: 110, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, marginBottom: 8 },
  simPrice: { fontSize: 15, fontWeight: '900', color: theme.colors.primary },
  simTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginTop: 2 },
  simMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  oldPrice: {
    fontSize: 16, fontWeight: '600', color: theme.colors.textMuted,
    textDecorationLine: 'line-through', marginLeft: 10,
  },
  reducedPill: {
    marginLeft: 10, backgroundColor: theme.colors.successSoft ?? '#D1FAE5',
    color: theme.colors.success, fontSize: 11, fontWeight: '900',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden', letterSpacing: 0.5,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card,
    padding: 10, borderRadius: theme.radius.md, marginBottom: 6,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  historyArrow: { fontSize: 16, fontWeight: '900', color: theme.colors.success, width: 20 },
  historyText: { flex: 1, fontSize: 13, color: theme.colors.text, fontWeight: '600' },
  historyArrowInline: { color: theme.colors.textMuted, fontWeight: '400' },
  historyDate: { fontSize: 11, color: theme.colors.textMuted },
  soldTitle: { color: theme.colors.success, fontWeight: '800', fontSize: 15 },
  soldSub: { color: theme.colors.textMuted, marginTop: 2, fontSize: 12 },
  reservedCard: { borderWidth: 1, borderColor: theme.colors.accent, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.primarySoft },
  reservedTitle: { color: theme.colors.accent, fontWeight: '800', fontSize: 15 },
  reservedSub: { color: theme.colors.text, marginTop: 2, fontSize: 12 },
});
