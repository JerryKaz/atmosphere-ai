import { Cloud, Gauge, Leaf, Sun, Sunrise, Wind } from 'lucide-react';
import type { AirQuality, WeatherData } from '../services/weatherService';
import { aqiLevel, cardinal, clockLabel, minutesOfDay, uvLevel, windSpeed, type Unit } from '../lib/format';

export function Details({ weather, air, unit }: { weather: WeatherData; air: AirQuality | null; unit: Unit }) {
  const c = weather.current;
  const today = weather.daily[0];
  const uv = uvLevel(c.uvIndex);

  return (
    <section aria-label="Details" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <Tile icon={<Wind size={15} />} title="Wind">
        <div className="flex items-center gap-4">
          <Compass deg={c.windDirection} />
          <div>
            <p className="text-2xl font-semibold text-ink">{windSpeed(c.windSpeed, unit)}</p>
            <p className="text-xs text-ink-soft">
              From {cardinal(c.windDirection)} · gusts {windSpeed(c.windGusts, unit)}
            </p>
          </div>
        </div>
      </Tile>

      <Tile icon={<Sun size={15} />} title="UV index">
        <p className="text-2xl font-semibold text-ink">
          {Math.round(c.uvIndex)} <span className="text-base font-medium text-ink-soft">{uv.label}</span>
        </p>
        <Meter value={Math.min(c.uvIndex / 11, 1)} />
        <p className="mt-2 text-xs text-ink-soft">
          {c.uvIndex >= 3 ? 'Wear sunscreen and sunglasses.' : 'No sun protection needed.'} Peak today {Math.round(today.uvIndexMax)}.
        </p>
      </Tile>

      <Tile icon={<Leaf size={15} />} title="Air quality">
        {air ? (
          <>
            <p className="text-2xl font-semibold text-ink">
              {Math.round(air.usAqi)} <span className="text-base font-medium text-ink-soft">{aqiLevel(air.usAqi).label}</span>
            </p>
            <Meter value={Math.min(air.usAqi / 300, 1)} />
            <p className="mt-2 text-xs text-ink-soft">{aqiLevel(air.usAqi).advice}</p>
          </>
        ) : (
          <p className="text-sm text-ink-soft">Not available for this location.</p>
        )}
      </Tile>

      <Tile icon={<Sunrise size={15} />} title="Sunrise & sunset" wide>
        <SunArc now={c.time} sunrise={today.sunrise} sunset={today.sunset} />
      </Tile>

      <Tile icon={<Gauge size={15} />} title="Pressure">
        <p className="text-2xl font-semibold text-ink">
          {Math.round(c.pressure)} <span className="text-base font-medium text-ink-soft">hPa</span>
        </p>
        <p className="mt-1 text-xs text-ink-soft">{c.pressure < 1005 ? 'Low: unsettled weather likely.' : c.pressure > 1020 ? 'High: settled weather.' : 'Normal.'}</p>
      </Tile>

      <Tile icon={<Cloud size={15} />} title="Cloud cover">
        <p className="text-2xl font-semibold text-ink">{c.cloudCover}%</p>
        <Meter value={c.cloudCover / 100} plain />
      </Tile>
    </section>
  );
}

function Tile({ icon, title, children, wide }: { icon: React.ReactNode; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`card p-5 ${wide ? 'col-span-2 lg:col-span-1 lg:row-span-1' : ''}`}>
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        <span className="text-sage">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Meter({ value, plain }: { value: number; plain?: boolean }) {
  return (
    <div className="relative mt-3 h-1.5 rounded-full bg-mist">
      {plain ? (
        <div className="absolute inset-y-0 left-0 rounded-full bg-slate-400" style={{ width: `${value * 100}%` }} />
      ) : (
        <>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 via-60% to-violet-500 opacity-80" />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow"
            style={{ left: `${value * 100}%` }}
          />
        </>
      )}
    </div>
  );
}

function Compass({ deg }: { deg: number }) {
  return (
    <div className="relative h-14 w-14 shrink-0 rounded-full border border-line bg-mist" aria-hidden="true">
      {['N', 'E', 'S', 'W'].map((d, i) => (
        <span
          key={d}
          className="absolute text-[8px] font-bold text-ink-soft"
          style={{
            top: i === 0 ? 2 : i === 2 ? undefined : '50%',
            bottom: i === 2 ? 2 : undefined,
            left: i === 3 ? 4 : i === 1 ? undefined : '50%',
            right: i === 1 ? 4 : undefined,
            transform: i === 0 || i === 2 ? 'translateX(-50%)' : 'translateY(-50%)',
          }}
        >
          {d}
        </span>
      ))}
      {/* Arrow points where the wind is blowing TO. */}
      <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700" style={{ transform: `rotate(${deg + 180}deg)` }}>
        <div className="h-7 w-0.5 rounded-full bg-gradient-to-t from-transparent to-clay" />
      </div>
    </div>
  );
}

function SunArc({ now, sunrise, sunset }: { now: string; sunrise: string; sunset: string }) {
  const rise = minutesOfDay(sunrise);
  const set = minutesOfDay(sunset);
  const cur = minutesOfDay(now);
  const t = Math.min(1, Math.max(0, (cur - rise) / Math.max(1, set - rise)));
  const up = cur >= rise && cur <= set;
  const daylight = set - rise;
  // Point on a half-ellipse from (10,60) to (190,60), peak at y=8.
  const x = 10 + 180 * t;
  const y = 60 - 52 * Math.sin(Math.PI * t);

  return (
    <div>
      <svg viewBox="0 0 200 68" className="w-full" role="img" aria-label={`Sunrise ${clockLabel(sunrise)}, sunset ${clockLabel(sunset)}`}>
        <path d="M10 60 A90 52 0 0 1 190 60" fill="none" stroke="currentColor" className="text-line" strokeWidth="2" strokeDasharray="4 5" />
        {up && (
          <path
            d={`M10 60 A90 52 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`}
            fill="none"
            stroke="#F2B544"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        <line x1="0" y1="60" x2="200" y2="60" stroke="currentColor" className="text-line" />
        {up && <circle cx={x} cy={y} r="6" fill="#F2B544" stroke="white" strokeWidth="2" />}
      </svg>
      <div className="mt-1 flex justify-between text-xs">
        <span>
          <span className="block text-ink-soft">Sunrise</span>
          <span className="font-semibold text-ink">{clockLabel(sunrise)}</span>
        </span>
        <span className="text-center text-ink-soft">
          {Math.floor(daylight / 60)}h {daylight % 60}m
          <span className="block">of daylight</span>
        </span>
        <span className="text-right">
          <span className="block text-ink-soft">Sunset</span>
          <span className="font-semibold text-ink">{clockLabel(sunset)}</span>
        </span>
      </div>
    </div>
  );
}
