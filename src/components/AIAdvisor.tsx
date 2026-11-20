import { AlertTriangle, RefreshCw, Shirt, Sparkles, Compass } from 'lucide-react';
import type { WeatherInsight } from '../services/geminiService';

interface Props {
  insight: WeatherInsight | null;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
}

export function AIAdvisor({ insight, loading, error, onRegenerate }: Props) {
  return (
    <section aria-label="AI advisor" className="card flex h-full flex-col p-6 sm:p-7">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-2xl text-ink">
          <Sparkles size={18} className="text-clay" aria-hidden="true" />
          AI Advisor
        </h2>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-mist hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Thinking…' : 'New ideas'}
        </button>
      </div>

      {loading && !insight ? (
        <div className="space-y-4" aria-busy="true">
          <div className="h-4 w-1/3 animate-pulse rounded bg-mist" />
          <div className="h-5 w-full animate-pulse rounded bg-mist" />
          <div className="h-5 w-4/5 animate-pulse rounded bg-mist" />
          <div className="mt-6 h-4 w-1/3 animate-pulse rounded bg-mist" />
          <div className="flex gap-2">
            <div className="h-7 w-24 animate-pulse rounded-full bg-mist" />
            <div className="h-7 w-20 animate-pulse rounded-full bg-mist" />
          </div>
        </div>
      ) : error && !insight ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-3 rounded-2xl bg-mist p-5">
          <p className="text-sm text-ink">{error}</p>
          <p className="text-xs text-ink-soft">The forecast on this page doesn't depend on AI and is still live.</p>
        </div>
      ) : insight ? (
        <div className="flex flex-1 flex-col gap-6">
          {insight.alert && (
            <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{insight.alert}</p>
            </div>
          )}
          <div>
            <Label icon={<Shirt size={14} />}>What to wear</Label>
            <p className="text-base font-medium leading-snug text-ink">{insight.outfit}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{insight.outfitReason}</p>
          </div>
          <div>
            <Label icon={<Compass size={14} />}>Good for today</Label>
            <ul className="flex flex-wrap gap-2">
              {insight.activities.map((a) => (
                <li key={a} className="rounded-full bg-sage/10 px-3 py-1.5 text-xs font-medium text-sage-deep">
                  {a}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{insight.activitiesReason}</p>
          </div>
          <p className="mt-auto border-t border-line pt-4 font-serif text-lg italic leading-snug text-ink-soft">“{insight.summary}”</p>
        </div>
      ) : null}
    </section>
  );
}

function Label({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sage-deep">
      {icon}
      {children}
    </p>
  );
}
