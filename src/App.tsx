import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CloudSun, Moon, Sun, WifiOff, X } from 'lucide-react';
import { useWeather, type Place } from './hooks/useWeather';
import { useInsights } from './hooks/useInsights';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useOnline } from './hooks/useOnline';
import { formatLocation, reverseGeocode, type LocationResult } from './services/weatherService';
import { describeCode, severeAlertFor } from './lib/weatherCodes';
import { longDate, temp, type Unit } from './lib/format';
import { readJson } from './lib/storage';
import { SearchBox } from './components/SearchBox';
import { CurrentConditions } from './components/CurrentConditions';
import { AIAdvisor } from './components/AIAdvisor';
import { HourlyForecast } from './components/HourlyForecast';
import { DailyForecast } from './components/DailyForecast';
import { Details } from './components/Details';
import { LastYear } from './components/LastYear';
import { Toast, useToast } from './components/Toast';

const FALLBACK_PLACE: Place = { lat: 51.5074, lon: -0.1278, name: 'London, England, United Kingdom' };
const LAST_PLACE_KEY = 'atmosphere_last_place';
const MAX_RECENT = 6;

/** A place from ?lat=..&lon=..&name=.. so links open the same city. */
function placeFromUrl(): Place | null {
  const p = new URLSearchParams(window.location.search);
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  if (!p.has('lat') || !p.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, name: p.get('name') || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°` };
}

const samePlace = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;

export default function App() {
  const [place, setPlace] = useState<Place | null>(() => placeFromUrl() ?? readJson<Place | null>(LAST_PLACE_KEY, null));
  const [unit, setUnit] = useLocalStorage<Unit>('atmosphere_unit', 'c');
  // Light is the default. Dark only when the user has chosen it.
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('atmosphere_theme', 'light');
  const [recent, setRecent] = useLocalStorage<LocationResult[]>('atmosphere_recent_searches', []);
  const [favourites, setFavourites] = useLocalStorage<LocationResult[]>('atmosphere_favourites', []);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const online = useOnline();
  const toast = useToast();
  const dark = theme === 'dark';

  const { weather, air, status, error, updatedAt, fromCache, refresh } = useWeather(place);
  const ai = useInsights(weather);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141914' : '#F6F7F3');
  }, [dark]);

  // Persist and reflect the current place in the URL (shareable links).
  useEffect(() => {
    if (!place) return;
    localStorage.setItem(LAST_PLACE_KEY, JSON.stringify(place));
    const url = new URL(window.location.href);
    url.searchParams.set('lat', place.lat.toFixed(4));
    url.searchParams.set('lon', place.lon.toFixed(4));
    url.searchParams.set('name', place.name);
    window.history.replaceState(null, '', url);
    document.title = `${place.name.split(',')[0]} · Atmosphere AI`;
  }, [place]);

  useEffect(() => setAlertDismissed(false), [place?.lat, place?.lon]);

  const locate = useCallback(
    (silentFallback: boolean) => {
      if (!('geolocation' in navigator)) {
        if (silentFallback) setPlace((p) => p ?? FALLBACK_PLACE);
        setNotice("Your browser can't share its location. Search for a city instead.");
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          let name = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
          try {
            name = await reverseGeocode(lat, lon);
          } catch {
            /* keep coordinates as the name */
          }
          setPlace({ lat, lon, name });
          setLocating(false);
        },
        (err) => {
          setLocating(false);
          if (silentFallback) setPlace((p) => p ?? FALLBACK_PLACE);
          setNotice(
            err.code === 1
              ? 'Location access is off, so we are showing London. Search for your city or allow location access.'
              : "We couldn't find your location. Search for a city instead.",
          );
        },
        { timeout: 10000, maximumAge: 10 * 60 * 1000 },
      );
    },
    [],
  );

  // First visit with no saved place: ask for location once, fall back to London.
  useEffect(() => {
    if (!place) locate(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectLocation = (loc: LocationResult) => {
    setPlace({ lat: loc.lat, lon: loc.lon, name: formatLocation(loc) });
    setRecent((prev) => [loc, ...prev.filter((r) => !samePlace(r, loc))].slice(0, MAX_RECENT));
    setNotice(null);
  };

  const isFavourite = !!place && favourites.some((f) => samePlace(f, place));

  const toggleFavourite = () => {
    if (!place) return;
    if (isFavourite) {
      setFavourites((f) => f.filter((x) => !samePlace(x, place)));
      toast.show('Removed from saved places');
    } else {
      const [name, ...rest] = place.name.split(',').map((s) => s.trim());
      const country = rest.pop() ?? '';
      setFavourites((f) => [{ lat: place.lat, lon: place.lon, name, admin1: rest.join(', ') || undefined, country }, ...f].slice(0, 8));
      toast.show('Saved. Find it in the search box');
    }
  };

  const share = async () => {
    if (!weather || !place) return;
    const c = weather.current;
    const text = `${place.name.split(',')[0]}: ${temp(c.temp, unit)}°${unit.toUpperCase()}, ${describeCode(c.conditionCode).toLowerCase()}.` +
      (ai.insight ? ` Tip: ${ai.insight.outfit}` : '');
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Atmosphere AI', text, url });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') toast.show("Couldn't open the share sheet");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.show('Link copied to clipboard');
    } catch {
      toast.show("Couldn't copy the link");
    }
  };

  const severe = useMemo(() => (weather ? severeAlertFor(weather.current.conditionCode) : null), [weather]);
  const [cityName, ...regionParts] = (place?.name ?? '').split(',').map((s) => s.trim());

  return (
    <div className="min-h-screen bg-page text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        {/* Top bar */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a href="./" className="flex items-center gap-2 self-start" aria-label="Atmosphere AI home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-amber-300 text-white shadow-sm">
              <CloudSun size={19} />
            </span>
            <span className="font-serif text-xl font-semibold tracking-tight">Atmosphere</span>
            <span className="rounded-full bg-clay/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-clay-deep">AI</span>
          </a>
          <div className="flex items-center gap-2">
            <SearchBox
              recent={recent}
              favourites={favourites}
              onSelect={selectLocation}
              onUseMyLocation={() => locate(false)}
              onClearRecent={() => setRecent([])}
              locating={locating}
            />
            <div role="group" aria-label="Temperature unit" className="inline-flex shrink-0 rounded-full border border-line bg-card p-1 shadow-sm">
              {(['c', 'f'] as Unit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  onClick={() => setUnit(u)}
                  className={`h-8 w-9 rounded-full text-sm font-semibold transition ${unit === u ? 'bg-ink text-page' : 'text-ink-soft hover:text-ink'}`}
                >
                  °{u.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTheme(dark ? 'light' : 'dark')}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={dark ? 'Light theme' : 'Dark theme'}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink-soft shadow-sm transition hover:text-ink"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* Location title */}
        <div className="mt-10 mb-6">
          {place ? (
            <>
              <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                {cityName}
                {regionParts.length > 0 && <span className="font-normal italic text-ink-soft">, {regionParts.join(', ')}</span>}
              </h1>
              <p className="mt-2 text-sm font-medium text-ink-soft">
                {weather ? `${longDate(weather.current.time.slice(0, 10))} · local time ${weather.current.time.slice(11, 16)}` : 'Loading…'}
              </p>
            </>
          ) : (
            <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-mist" />
          )}
        </div>

        {/* Banners */}
        <div className="flex flex-col gap-3 empty:hidden">
          {!online && (
            <Banner tone="neutral" icon={<WifiOff size={16} />}>
              You're offline. Showing the last saved forecast{updatedAt ? '' : ' if available'}.
            </Banner>
          )}
          {online && error && (
            <Banner tone="warn" icon={<AlertTriangle size={16} />} action={{ label: 'Retry', onClick: refresh }}>
              {error}
            </Banner>
          )}
          {notice && (
            <Banner tone="neutral" icon={<AlertTriangle size={16} />} onClose={() => setNotice(null)}>
              {notice}
            </Banner>
          )}
          <AnimatePresence>
            {severe && !alertDismissed && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Banner tone="danger" icon={<AlertTriangle size={18} />} onClose={() => setAlertDismissed(true)}>
                  <strong className="mr-1">{severe.title}.</strong>
                  {severe.message}
                </Banner>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {weather && place ? (
          <main className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <CurrentConditions
                weather={weather}
                unit={unit}
                updatedAt={updatedAt}
                refreshing={status === 'loading'}
                isFavourite={isFavourite}
                onToggleFavourite={toggleFavourite}
                onRefresh={refresh}
                onShare={share}
              />
            </div>
            <div className="lg:col-span-4">
              <AIAdvisor insight={ai.insight} loading={ai.loading} error={ai.error} onRegenerate={ai.regenerate} />
            </div>
            <div className="lg:col-span-8">
              <HourlyForecast hours={weather.hourly} unit={unit} dark={dark} />
            </div>
            <div className="lg:col-span-4">
              <DailyForecast days={weather.daily} currentTemp={weather.current.temp} unit={unit} />
            </div>
            <div className="lg:col-span-12">
              <Details weather={weather} air={air} unit={unit} />
            </div>
            <div className="lg:col-span-12">
              <LastYear lat={place.lat} lon={place.lon} days={weather.daily} unit={unit} dark={dark} />
            </div>
            {fromCache && status !== 'ready' && (
              <p className="text-xs text-ink-soft lg:col-span-12">Showing saved data while the latest forecast loads.</p>
            )}
          </main>
        ) : status === 'error' ? (
          <div className="card mt-4 flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-serif text-2xl">The forecast didn't load</p>
            <p className="max-w-md text-sm text-ink-soft">Check your connection and try again, or search for another city.</p>
            <button onClick={refresh} className="mt-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-page">
              Try again
            </button>
          </div>
        ) : (
          <LoadingSkeleton />
        )}

        <footer className="mt-14 flex flex-col items-center gap-2 text-center text-xs text-ink-soft">
          <p>
            Weather data by{' '}
            <a className="underline decoration-line underline-offset-2 hover:text-ink" href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">
              Open-Meteo
            </a>{' '}
            · Advice by Google Gemini
          </p>
          <p>
            © {new Date().getFullYear()}{' '}
            <a href="https://github.com/JerryKaz" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
              Jerry Myron
            </a>
          </p>
        </footer>
      </div>
      <Toast message={toast.message} />
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
  onClose,
  action,
}: {
  tone: 'neutral' | 'warn' | 'danger';
  icon: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
  action?: { label: string; onClick: () => void };
}) {
  const styles = {
    neutral: 'border-line bg-card text-ink',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="flex-1">{children}</p>
      {action && (
        <button onClick={action.onClick} className="shrink-0 font-semibold underline underline-offset-2">
          {action.label}
        </button>
      )}
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="shrink-0 rounded-full p-0.5 opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12" aria-busy="true" aria-label="Loading forecast">
      <div className="card h-72 animate-pulse lg:col-span-8" />
      <div className="card h-72 animate-pulse lg:col-span-4" />
      <div className="card h-80 animate-pulse lg:col-span-8" />
      <div className="card h-80 animate-pulse lg:col-span-4" />
    </div>
  );
}
