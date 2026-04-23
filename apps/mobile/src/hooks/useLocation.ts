import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

const FALLBACK = { lat: 28.4912, lng: 77.0896 };

export function useLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastGeoRef = useRef<{ lat: number; lng: number } | null>(null);

  const reverseGeo = useCallback(async (lat: number, lng: number) => {
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const p = places[0] as any;
      if (!p) return;
      const parts = [p.subLocality ?? p.district ?? p.street, p.city ?? p.region].filter(Boolean);
      if (parts.length) setLabel(parts.join(', '));
    } catch { /* noop */ }
  }, []);

  const maybeReverseGeo = useCallback((lat: number, lng: number) => {
    const last = lastGeoRef.current;
    if (last) {
      const dLat = Math.abs(lat - last.lat);
      const dLng = Math.abs(lng - last.lng);
      if (dLat < 0.003 && dLng < 0.003) return;
    }
    lastGeoRef.current = { lat, lng };
    reverseGeo(lat, lng);
  }, [reverseGeo]);

  const start = useCallback(async () => {
    setRefreshing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('permission_denied');
        setCoords(FALLBACK);
        maybeReverseGeo(FALLBACK.lat, FALLBACK.lng);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setCoords(next);
      setError(null);
      maybeReverseGeo(next.lat, next.lng);

      watchRef.current?.remove();
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 50 },
        (l) => {
          const c = { lat: l.coords.latitude, lng: l.coords.longitude };
          setCoords(c);
          maybeReverseGeo(c.lat, c.lng);
        },
      );
    } catch {
      setError('location_failed');
      setCoords(FALLBACK);
      maybeReverseGeo(FALLBACK.lat, FALLBACK.lng);
    } finally {
      setRefreshing(false);
    }
  }, [maybeReverseGeo]);

  useEffect(() => {
    start();
    return () => { watchRef.current?.remove(); watchRef.current = null; };
  }, [start]);

  return {
    coords: coords ?? FALLBACK,
    label,
    hasReal: coords !== null && !error,
    error,
    refreshing,
    refresh: start,
  };
}
