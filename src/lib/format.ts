export type Unit = 'c' | 'f';

export function temp(c: number, unit: Unit): number {
  return Math.round(unit === 'f' ? (c * 9) / 5 + 32 : c);
}

export function windSpeed(kmh: number, unit: Unit): string {
  return unit === 'f' ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`;
}

export function cardinal(deg: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

/** Hour label from a location-local ISO string ("2026-11-20T16:00"). */
export function hourLabel(iso: string): string {
  const h = Number(iso.slice(11, 13));
  const suffix = h < 12 ? 'am' : 'pm';
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}

/** "6:42 am" from a location-local ISO string. */
export function clockLabel(iso: string): string {
  const h = Number(iso.slice(11, 13));
  const m = iso.slice(14, 16);
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** Weekday for a YYYY-MM-DD date, independent of the browser's time zone. */
export function weekday(date: string, style: 'short' | 'long' = 'short'): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: style, timeZone: 'UTC' });
}

export function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function minutesOfDay(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

export function timeAgo(ts: number, now = Date.now()): string {
  const mins = Math.round((now - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}

export function uvLevel(uv: number): { label: string; tone: string } {
  if (uv < 3) return { label: 'Low', tone: 'bg-emerald-500' };
  if (uv < 6) return { label: 'Moderate', tone: 'bg-amber-400' };
  if (uv < 8) return { label: 'High', tone: 'bg-orange-500' };
  if (uv < 11) return { label: 'Very high', tone: 'bg-rose-500' };
  return { label: 'Extreme', tone: 'bg-violet-600' };
}

export function aqiLevel(aqi: number): { label: string; tone: string; advice: string } {
  if (aqi <= 50) return { label: 'Good', tone: 'bg-emerald-500', advice: 'Air is clean. Enjoy time outside.' };
  if (aqi <= 100) return { label: 'Moderate', tone: 'bg-amber-400', advice: 'Fine for most people; sensitive groups should take it easy.' };
  if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', tone: 'bg-orange-500', advice: 'Limit long outdoor exertion if you are sensitive.' };
  if (aqi <= 200) return { label: 'Unhealthy', tone: 'bg-rose-500', advice: 'Reduce prolonged outdoor activity.' };
  if (aqi <= 300) return { label: 'Very unhealthy', tone: 'bg-violet-600', advice: 'Avoid outdoor exertion.' };
  return { label: 'Hazardous', tone: 'bg-red-900', advice: 'Stay indoors with windows closed.' };
}
