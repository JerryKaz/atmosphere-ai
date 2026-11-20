import { motion } from 'motion/react';
import { Droplets, RefreshCw, Share2, Star, Umbrella } from 'lucide-react';
import type { WeatherData } from '../services/weatherService';
import { describeCode, iconForCode } from '../lib/weatherCodes';
import { cardinal, clockLabel, temp, timeAgo, uvLevel, windSpeed, type Unit } from '../lib/format';
import { WeatherIcon } from './WeatherIcon';

interface Props {
  weather: WeatherData;
  unit: Unit;
  updatedAt: number | null;
  refreshing: boolean;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onRefresh: () => void;
  onShare: () => void;
}

// Soft, light backgrounds that hint at the conditions without hurting legibility.
function skyFor(code: number, isDay: boolean): string {
  if (!isDay) return 'from-indigo-100 via-slate-50 to-white';
  switch (iconForCode(code)) {
    case 'clear':
      return 'from-sky-100 via-amber-50 to-white';
    case 'partly':
      return 'from-sky-100 via-sky-50 to-white';
    case 'rain':
    case 'drizzle':
      return 'from-slate-200 via-sky-50 to-white';
    case 'snow':
      return 'from-sky-50 via-white to-white';
    case 'storm':
      return 'from-violet-100 via-slate-50 to-white';
    default:
      return 'from-slate-100 via-slate-50 to-white';
  }
}

export function CurrentConditions({ weather, unit, updatedAt, refreshing, isFavourite, onToggleFavourite, onRefresh, onShare }: Props) {
  const c = weather.current;
  const today = weather.daily[0];
  const rainSoon = Math.max(0, ...weather.hourly.slice(0, 6).map((h) => h.precipProbability));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Current conditions"
      className={`card relative flex h-full flex-col overflow-hidden bg-gradient-to-br ${skyFor(c.conditionCode, c.isDay)} p-6 sm:p-8`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium text-ink-soft">
          {updatedAt ? `Updated ${timeAgo(updatedAt)}` : 'Updating…'}
        </p>
        <div className="flex items-center gap-1.5">
          <IconButton label={isFavourite ? 'Remove from saved places' : 'Save this place'} onClick={onToggleFavourite} pressed={isFavourite}>
            <Star size={17} className={isFavourite ? 'fill-amber-400 text-amber-400' : ''} />
          </IconButton>
          <IconButton label="Share" onClick={onShare}>
            <Share2 size={17} />
          </IconButton>
          <IconButton label="Refresh" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          </IconButton>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-5 sm:gap-7">
          <WeatherIcon code={c.conditionCode} isDay={c.isDay} size={84} animated className="drop-shadow-sm" />
          <div>
            <p className="font-display text-[88px] font-light leading-none tracking-tight text-ink sm:text-[112px]">
              {temp(c.temp, unit)}°
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="font-serif text-3xl italic text-ink sm:text-4xl">{describeCode(c.conditionCode)}</p>
          <p className="mt-1 text-sm text-ink-soft">
            Feels like <span className="font-semibold text-ink">{temp(c.feelsLike, unit)}°</span>
            <span className="mx-2 text-line">|</span>
            H <span className="font-semibold text-ink">{temp(today.maxTemp, unit)}°</span> · L{' '}
            <span className="font-semibold text-ink">{temp(today.minTemp, unit)}°</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Chip icon={<Umbrella size={14} />}>
          {rainSoon >= 50 ? `Rain likely soon (${rainSoon}%)` : rainSoon >= 20 ? `Chance of rain ${rainSoon}%` : 'Dry for the next few hours'}
        </Chip>
        <Chip icon={<Droplets size={14} />}>Humidity {c.humidity}%</Chip>
        {c.precipitation > 0 && <Chip icon={<Droplets size={14} />}>{c.precipitation} mm falling now</Chip>}
      </div>
      <div className="min-h-8 flex-1" />
      <dl className="grid grid-cols-3 pt-6 gap-3 border-t border-ink/5 pt-6">
        <Glance label="Wind" value={windSpeed(c.windSpeed, unit)} sub={`from ${cardinal(c.windDirection)}`} />
        <Glance label="UV index" value={String(Math.round(c.uvIndex))} sub={uvLevel(c.uvIndex).label} />
        <Glance
          label={c.isDay ? 'Sunset' : 'Sunrise'}
          value={clockLabel(c.isDay ? today.sunset : (weather.daily[1] ?? today).sunrise)}
          sub={c.isDay ? 'today' : 'tomorrow'}
        />
      </dl>

    </motion.section>
  );
}

function Glance({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-ink sm:text-xl">{value}</dd>
      <dd className="text-xs text-ink-soft">{sub}</dd>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink backdrop-blur">
      <span className="text-sky">{icon}</span>
      {children}
    </span>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/80 text-ink-soft shadow-sm transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage/20 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
