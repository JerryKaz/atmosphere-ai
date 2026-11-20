import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAirQuality,
  fetchWeather,
  type AirQuality,
  type WeatherData,
} from '../services/weatherService';
import { readJson, writeJson } from '../lib/storage';

export interface Place {
  lat: number;
  lon: number;
  name: string;
}

interface CachedEntry {
  weather: WeatherData;
  air: AirQuality | null;
  at: number;
}

const CACHE_KEY = 'atmosphere_weather_cache_v2';
const MAX_CACHED_PLACES = 8;
const AUTO_REFRESH_MS = 10 * 60 * 1000;

const placeKey = (p: Pick<Place, 'lat' | 'lon'>) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

function readCache(p: Place): CachedEntry | null {
  const all = readJson<Record<string, CachedEntry>>(CACHE_KEY, {});
  const hit = all[placeKey(p)];
  return hit?.weather?.current ? hit : null;
}

function writeCache(p: Place, entry: CachedEntry) {
  const all = readJson<Record<string, CachedEntry>>(CACHE_KEY, {});
  all[placeKey(p)] = entry;
  const trimmed = Object.entries(all)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, MAX_CACHED_PLACES);
  writeJson(CACHE_KEY, Object.fromEntries(trimmed));
}

export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Loads weather + air quality for a place.
 * - Shows cached data for that place instantly, then refreshes in the background.
 * - Cancels in-flight requests when the place changes (no stale overwrites).
 * - Refreshes every 10 minutes and when the tab becomes visible again.
 */
export function useWeather(place: Place | null) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [air, setAir] = useState<AirQuality | null>(null);
  const [status, setStatus] = useState<WeatherStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (p: Place) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('loading');
    setError(null);
    try {
      const [w, a] = await Promise.all([
        fetchWeather(p.lat, p.lon, controller.signal),
        fetchAirQuality(p.lat, p.lon, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      const at = Date.now();
      setWeather(w);
      setAir(a);
      setUpdatedAt(at);
      setFromCache(false);
      setStatus('ready');
      writeCache(p, { weather: w, air: a, at });
    } catch (err) {
      if ((err as Error).name === 'AbortError' || controller.signal.aborted) return;
      setStatus('error');
      setError(
        navigator.onLine
          ? "Couldn't reach the weather service. Showing the last saved data if there is any."
          : "You're offline. Showing the last saved data.",
      );
    }
  }, []);

  // New place: show its cache (if any) straight away, then fetch.
  useEffect(() => {
    if (!place) return;
    const cached = readCache(place);
    if (cached) {
      setWeather(cached.weather);
      setAir(cached.air);
      setUpdatedAt(cached.at);
      setFromCache(true);
    } else {
      setWeather(null);
      setAir(null);
      setUpdatedAt(null);
      setFromCache(false);
    }
    load(place);
    return () => controllerRef.current?.abort();
  }, [place?.lat, place?.lon, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh while the tab is visible, plus a refresh on return.
  useEffect(() => {
    if (!place) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(place);
    }, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && updatedAt && Date.now() - updatedAt > AUTO_REFRESH_MS) load(place);
    };
    const onOnline = () => load(place);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [place, updatedAt, load]);

  const refresh = useCallback(() => {
    if (place) load(place);
  }, [place, load]);

  return { weather, air, status, error, updatedAt, fromCache, refresh };
}
