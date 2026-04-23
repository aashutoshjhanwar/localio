import ngeohash from 'ngeohash';

// precision 6 ≈ 1.2 km cells, good for neighborhood queries
export const GEOHASH_PRECISION = 6;

export function encodeGeohash(lat: number, lng: number, precision = GEOHASH_PRECISION): string {
  return ngeohash.encode(lat, lng, precision);
}

export function neighborGeohashes(hash: string): string[] {
  return [hash, ...ngeohash.neighbors(hash)];
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
