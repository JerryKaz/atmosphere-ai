import { Droplet } from 'lucide-react';
import type { DailyPoint } from '../services/weatherService';
import { describeCode } from '../lib/weatherCodes';
import { temp, weekday, type Unit } from '../lib/format';
import { WeatherIcon } from './WeatherIcon';

export function DailyForecast({ days, currentTemp, unit }: { days: DailyPoint[]; currentTemp: number; unit: Unit }) {
  const weekMin = Math.min(...days.map((d) => d.minTemp));
  const weekMax = Math.max(...days.map((d) => d.maxTemp));
  const span = Math.max(1, weekMax - weekMin);
  const pct = (v: number) => ((v - weekMin) / span) * 100;

  return (
    <section aria-label="7-day forecast" className="card p-6 sm:p-7">
      <h2 className="mb-4 font-serif text-2xl text-ink">7-day forecast</h2>
      <ul className="divide-y divide-line">
        {days.map((d, i) => (
          <li key={d.date} className="grid grid-cols-[3.5rem_2rem_2.75rem_2.25rem_1fr_2.25rem] items-center gap-2 py-3 text-sm">
            <span className={`font-medium ${i === 0 ? 'text-ink' : 'text-ink-soft'}`}>{i === 0 ? 'Today' : weekday(d.date)}</span>
            <span title={describeCode(d.conditionCode)} className="flex justify-center">
              <WeatherIcon code={d.conditionCode} isDay size={20} />
              <span className="sr-only">{describeCode(d.conditionCode)}</span>
            </span>
            <span
              className={`flex items-center gap-0.5 text-xs font-medium ${d.precipProbability >= 30 ? 'text-sky' : 'text-transparent'}`}
              aria-label={`${d.precipProbability}% chance of rain`}
            >
              <Droplet size={10} aria-hidden="true" />
              {d.precipProbability}%
            </span>
            <span className="text-right text-ink-soft">{temp(d.minTemp, unit)}°</span>
            <div className="relative h-1.5 rounded-full bg-mist" aria-hidden="true">
              <div
                className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-300 via-amber-300 to-orange-400"
                style={{ left: `${pct(d.minTemp)}%`, right: `${100 - pct(d.maxTemp)}%` }}
              />
              {i === 0 && (
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow"
                  style={{ left: `${Math.min(100, Math.max(0, pct(currentTemp)))}%` }}
                  title="Now"
                />
              )}
            </div>
            <span className="text-right font-semibold text-ink">{temp(d.maxTemp, unit)}°</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
