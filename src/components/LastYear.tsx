import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { History, Loader2 } from 'lucide-react';
import { fetchLastYear, type DailyPoint, type HistoricalData } from '../services/weatherService';
import { temp, weekday, type Unit } from '../lib/format';

interface Props {
  lat: number;
  lon: number;
  days: DailyPoint[];
  unit: Unit;
  dark: boolean;
}

export function LastYear({ lat, lon, days, unit, dark }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Reset when the place changes.
  useEffect(() => {
    setData(null);
    setOpen(false);
  }, [lat, lon]);

  useEffect(() => {
    if (!open || data) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetchLastYear(lat, lon, days.map((d) => d.date), controller.signal)
      .then(setData)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, data, lat, lon, days]);

  const chart = useMemo(() => {
    if (!data) return [];
    return days.map((d, i) => ({
      day: weekday(d.date),
      thisYear: temp(d.maxTemp, unit),
      lastYear: data.lastYearMax[i] != null ? temp(data.lastYearMax[i], unit) : null,
    }));
  }, [data, days, unit]);

  const diff = useMemo(() => {
    const pairs = chart.filter((c) => c.lastYear != null);
    if (!pairs.length) return null;
    return pairs.reduce((s, c) => s + (c.thisYear - (c.lastYear as number)), 0) / pairs.length;
  }, [chart]);

  const axis = dark ? '#A9B3A3' : '#7A8475';

  return (
    <section aria-label="Compared with last year" className="card p-6 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl text-ink">
            <History size={18} className="text-sage" aria-hidden="true" />
            This week vs last year
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Daily highs for the coming week against the same dates a year ago.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-mist"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {open ? 'Hide comparison' : 'Compare'}
        </button>
      </div>

      {open && (
        <div className="mt-6">
          {error ? (
            <p className="text-sm text-ink-soft">Historical data isn't available right now.</p>
          ) : data ? (
            <>
              {diff != null && (
                <p className="mb-4 text-sm text-ink">
                  On average this week is{' '}
                  <span className="font-semibold">
                    {Math.abs(diff) < 0.5 ? 'about the same as' : `${Math.abs(diff).toFixed(1)}° ${diff > 0 ? 'warmer' : 'cooler'} than`}
                  </span>{' '}
                  last year.
                </p>
              )}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={axis} strokeOpacity={0.15} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: axis, fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: axis, fontSize: 11 }} unit="°" domain={['dataMin - 2', 'dataMax + 2']} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #E5E8E0', fontSize: 12, background: dark ? '#222A22' : '#fff' }}
                      formatter={(v, name) => [`${v}°`, name === 'thisYear' ? 'This year' : 'Last year']}
                    />
                    <Legend formatter={(v) => (v === 'thisYear' ? 'This year' : 'Last year')} wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="thisYear" stroke="#E0955E" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="lastYear" stroke={axis} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="h-56 animate-pulse rounded-2xl bg-mist" />
          )}
        </div>
      )}
    </section>
  );
}
