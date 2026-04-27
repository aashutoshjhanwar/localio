import ngeohash from 'ngeohash';

// precision 6 ≈ 1.2 km cells, good for neighborhood queries
export const GEOHASH_PRECISION = 6;

export function encodeGeohash(lat: number, lng: number, precision = GEOHASH_PRECISION): string {
  return ngeohash.encode(lat, lng, precision);
}

export function neighborGeohashes(hash: string): string[] {
  return [hash, ...ngeohash.neighbors(hash)];
}

// Bounding box for a radius in km — usable directly in Prisma `lat BETWEEN .. AND lng BETWEEN ..` filters.
// At ~28°N, 1° lat ≈ 111 km, 1° lng ≈ 98 km. We use 111 km for both with a small safety margin so the
// box always contains the full circle. Haversine still does the exact filter afterward.
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 110;
  const cosLat = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const dLng = radiusKm / (110 * cosLat);
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

// Prisma `where` fragment for "rows whose (lat,lng) lie within radiusKm of the point".
// SAFE for large radii (50+ km) — replaces the old neighborGeohashes which only covered ~3 km.
export function geoBoxWhere(lat: number, lng: number, radiusKm: number) {
  const b = boundingBox(lat, lng, radiusKm);
  return {
    lat: { gte: b.minLat, lte: b.maxLat },
    lng: { gte: b.minLng, lte: b.maxLng },
  };
}

// Haversine distance in km
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 =
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}
