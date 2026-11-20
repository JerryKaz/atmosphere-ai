import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplet, Navigation } from 'lucide-react';
import type { HourlyPoint } from '../services/weatherService';
import { cardinal, hourLabel, temp, windSpeed, type Unit } from '../lib/format';
import { WeatherIcon } from './WeatherIcon';

type Metric = 'temp' | 'rain' | 'wind';

const METRICS: { id: Metric; label: string }[] = [
  { id: 'temp', label: 'Temperature' },
  { id: 'rain', label: 'Rain chance' },
  { id: 'wind', label: 'Wind' },
];

export function HourlyForecast({ hours, unit, dark }: { hours: HourlyPoint[]; unit: Unit; dark: boolean }) {
  const [metric, setMetric] = useState<Metric>('temp');
  const axis = dark ? '#A9B3A3' : '#7A8475';
  const accent = metric === 'rain' ? '#4A90D9' : metric === 'wind' ? '#7C9070' : '#E0955E';

  const data = useMemo(
    () =>
      hours.map((h, i) => ({
        label: i === 0 ? 'Now' : hourLabel(h.time),
        temp: temp(h.temp, unit),
        feels: temp(h.feelsLike, unit),
        rain: h.precipProbability,
        wind: Math.round(unit === 'f' ? h.windSpeed * 0.621371 : h.windSpeed),
        windDir: h.windDirection,
      })),
    [hours, unit],
  );

  const tooltip = (
    <Tooltip
      cursor={{ stroke: axis, strokeOpacity: 0.3, fill: axis, fillOpacity: 0.06 }}
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload as (typeof data)[number];
        return (
          <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-lg">
            <p className="mb-1 font-semibold text-ink">{d.label}</p>
            <p className="text-ink">
              {d.temp}° <span className="text-ink-soft">feels {d.feels}°</span>
            </p>
            <p className="text-ink-soft">Rain {d.rain}%</p>
            <p className="text-ink-soft">
              Wind {d.wind} {unit === 'f' ? 'mph' : 'km/h'} {cardinal(d.windDir)}
            </p>
          </div>
        );
      }}
    />
  );

  return (
    <section aria-label="Next 24 hours" className="card p-6 sm:p-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-serif text-2xl text-ink">Next 24 hours</h2>
        <div role="tablist" aria-label="Chart metric" className="inline-flex rounded-full bg-mist p-1">
          {METRICS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={metric === m.id}
              onClick={() => setMetric(m.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                metric === m.id ? 'bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-48 w-full sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'rain' ? (
            <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval={3} tick={{ fill: axis, fontSize: 11 }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: axis, fontSize: 11 }} unit="%" width={40} />
              {tooltip}
              <Bar dataKey="rain" fill={accent} radius={[6, 6, 0, 0]} fillOpacity={0.85} />
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval={3} tick={{ fill: axis, fontSize: 11 }} />
              <YAxis
                domain={['dataMin - 2', 'dataMax + 2']}
                axisLine={false}
                tickLine={false}
                tick={{ fill: axis, fontSize: 11 }}
                allowDecimals={false}
                width={40}
                unit={metric === 'temp' ? '°' : ''}
              />
              {tooltip}
              <Area
                type="monotone"
                dataKey={metric}
                stroke={accent}
                strokeWidth={2.5}
                fill={`url(#grad-${metric})`}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <ol className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-thin">
        {hours.map((h, i) => (
          <li
            key={h.time}
            className={`flex min-w-[68px] flex-col items-center gap-1.5 rounded-2xl px-2 py-3 ${
              i === 0 ? 'bg-ink text-white' : 'bg-mist text-ink'
            }`}
          >
            <span className={`text-[11px] font-semibold ${i === 0 ? 'text-white/80' : 'text-ink-soft'}`}>
              {i === 0 ? 'Now' : hourLabel(h.time)}
            </span>
            <WeatherIcon code={h.conditionCode} isDay={h.isDay} size={22} />
            <span className="text-sm font-semibold">{temp(h.temp, unit)}°</span>
            {metric === 'wind' ? (
              <span className={`flex items-center gap-0.5 text-[10px] ${i === 0 ? 'text-white/80' : 'text-ink-soft'}`}>
                <Navigation size={9} style={{ transform: `rotate(${h.windDirection + 180}deg)` }} aria-hidden="true" />
                {windSpeed(h.windSpeed, unit).split(' ')[0]}
              </span>
            ) : (
              <span
                className={`flex items-center gap-0.5 text-[10px] font-medium ${
                  i === 0 ? 'text-sky-200' : h.precipProbability >= 30 ? 'text-sky' : 'text-ink-soft/60'
                }`}
              >
                <Droplet size={9} aria-hidden="true" />
                {h.precipProbability}%
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
