import { AnimatePresence, motion } from 'motion/react';
import Fuse from 'fuse.js';
import { History, Loader2, LocateFixed, MapPin, Search, Star, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { formatLocation, searchLocations, type LocationResult } from '../services/weatherService';

interface Props {
  recent: LocationResult[];
  favourites: LocationResult[];
  onSelect: (loc: LocationResult) => void;
  onUseMyLocation: () => void;
  onClearRecent: () => void;
  locating: boolean;
}

type Option =
  | { kind: 'locate' }
  | { kind: 'place'; loc: LocationResult; group: 'result' | 'favourite' | 'recent' };

const DEBOUNCE_MS = 300;

export function SearchBox({ recent, favourites, onSelect, onUseMyLocation, onClearRecent, locating }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [noMatch, setNoMatch] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Live suggestions, debounced, with stale requests cancelled.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setNoMatch(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const api = await searchLocations(q, controller.signal);
        // Fuse re-ranks the API results so near-misses ("acra") still surface the best match.
        const ranked = new Fuse(api, { keys: ['name', 'admin1', 'country'], threshold: 0.4 }).search(q).map((r) => r.item);
        const final = (ranked.length ? ranked : api).slice(0, 6);
        setResults(final);
        setNoMatch(final.length === 0);
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([]);
          setNoMatch(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // "/" focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const options: Option[] = useMemo(() => {
    if (query.trim().length >= 2) return results.map((loc) => ({ kind: 'place', loc, group: 'result' }) as Option);
    const favKeys = new Set(favourites.map((f) => `${f.lat},${f.lon}`));
    return [
      { kind: 'locate' } as Option,
      ...favourites.map((loc) => ({ kind: 'place', loc, group: 'favourite' }) as Option),
      ...recent
        .filter((r) => !favKeys.has(`${r.lat},${r.lon}`))
        .map((loc) => ({ kind: 'place', loc, group: 'recent' }) as Option),
    ];
  }, [query, results, favourites, recent]);

  const choose = (opt: Option) => {
    if (opt.kind === 'locate') onUseMyLocation();
    else onSelect(opt.loc);
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[active];
      if (opt) choose(opt);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const groupLabel = (o: Option, i: number) => {
    if (o.kind !== 'place') return null;
    const prev = options[i - 1];
    if (prev && prev.kind === 'place' && prev.group === o.group) return null;
    if (o.group === 'favourite') return 'Saved places';
    if (o.group === 'recent') return 'Recent';
    return null;
  };

  const showPanel = open && (options.length > 0 || noMatch || loading);

  return (
    <div ref={rootRef} className="relative w-full sm:w-80">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && options[active] ? `${listId}-${active}` : undefined}
          aria-label="Search for a city"
          placeholder="Search a city…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-full border border-line bg-white py-3 pl-11 pr-20 text-sm text-ink shadow-sm transition placeholder:text-ink-soft/70 focus:border-sage focus:outline-none focus:ring-4 focus:ring-sage/15"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading && <Loader2 size={16} className="animate-spin text-ink-soft" aria-label="Searching" />}
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="rounded-full p-1.5 text-ink-soft hover:bg-mist hover:text-ink"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="hidden rounded-md border border-line bg-mist px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft sm:inline">/</kbd>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-ink/5"
          >
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {options.map((o, i) => {
                const label = groupLabel(o, i);
                const isActive = i === active;
                return (
                  <li key={o.kind === 'locate' ? 'locate' : `${o.group}-${o.loc.lat}-${o.loc.lon}`} role="presentation">
                    {label && (
                      <div className="flex items-center justify-between px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                        <span>{label}</span>
                        {label === 'Recent' && (
                          <button type="button" onClick={onClearRecent} className="normal-case tracking-normal hover:text-ink">
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(o)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isActive ? 'bg-mist' : ''}`}
                    >
                      {o.kind === 'locate' ? (
                        <>
                          {locating ? (
                            <Loader2 size={16} className="animate-spin text-sky" />
                          ) : (
                            <LocateFixed size={16} className="text-sky" />
                          )}
                          <span className="text-sm font-medium text-sky">Use my current location</span>
                        </>
                      ) : (
                        <>
                          {o.group === 'favourite' ? (
                            <Star size={15} className="fill-amber-400 text-amber-400" />
                          ) : o.group === 'recent' ? (
                            <History size={15} className="text-ink-soft" />
                          ) : (
                            <MapPin size={15} className="text-sage" />
                          )}
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-ink">{o.loc.name}</span>
                            <span className="truncate text-xs text-ink-soft">
                              {[o.loc.admin1, o.loc.country].filter(Boolean).join(', ') || formatLocation(o.loc)}
                            </span>
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {noMatch && !loading && (
              <p className="px-4 pb-4 pt-1 text-sm text-ink-soft">No places match “{query.trim()}”. Check the spelling or try a nearby city.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
