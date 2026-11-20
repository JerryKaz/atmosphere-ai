/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Open-Meteo: open source, no API key required.
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_GEOCODING_URL = 'https://nominatim.openstreetmap.org/reverse';

const HOURS_AHEAD = 24;

export interface CurrentWeather {
  time: string; // location-local ISO, e.g. "2026-11-20T16:15"
  temp: number;
  feelsLike: number;
  conditionCode: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  humidity: number;
  precipitation: number;
  pressure: number;
  cloudCover: number;
  uvIndex: number;
  isDay: boolean;
}

export interface HourlyPoint {
  time: string;
  temp: number;
  feelsLike: number;
  precipProbability: number;
  windSpeed: number;
  windDirection: number;
  conditionCode: number;
  isDay: boolean;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  maxTemp: number;
  minTemp: number;
  conditionCode: number;
  precipProbability: number;
  precipSum: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherData {
  timezone: string;
  current: CurrentWeather;
  hourly: HourlyPoint[]; // starts at the current hour
  daily: DailyPoint[]; // 7 days, today first
}

export interface AirQuality {
  usAqi: number;
  pm25: number;
  pm10: number;
}

export interface HistoricalData {
  dates: string[];
  lastYearMax: number[];
  lastYearMin: number[];
}

export interface LocationResult {
  lat: number;
  lon: number;
  name: string;
  country: string;
  admin1?: string;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,' +
      'cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index',
    hourly:
      'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,' +
      'wind_direction_10m,weather_code,is_day',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,' +
      'precipitation_sum,uv_index_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
  });

  const data = await getJson<any>(`${FORECAST_URL}?${params}`, signal);
  const c = data.current;
  const h = data.hourly;
  const d = data.daily;

  // Hourly arrays start at local midnight. Slice from the current hour so
  // "Now" really is now.
  const currentHour = String(c.time).slice(0, 13); // "YYYY-MM-DDTHH"
  let start = h.time.findIndex((t: string) => t.slice(0, 13) === currentHour);
  if (start < 0) start = 0;

  const hourly: HourlyPoint[] = h.time.slice(start, start + HOURS_AHEAD).map((time: string, j: number) => {
    const i = start + j;
    return {
      time,
      temp: h.temperature_2m[i],
      feelsLike: h.apparent_temperature[i],
      precipProbability: h.precipitation_probability[i] ?? 0,
      windSpeed: h.wind_speed_10m[i],
      windDirection: h.wind_direction_10m[i],
      conditionCode: h.weather_code[i],
      isDay: h.is_day[i] === 1,
    };
  });

  const daily: DailyPoint[] = d.time.map((date: string, i: number) => ({
    date,
    maxTemp: d.temperature_2m_max[i],
    minTemp: d.temperature_2m_min[i],
    conditionCode: d.weather_code[i],
    precipProbability: d.precipitation_probability_max[i] ?? 0,
    precipSum: d.precipitation_sum[i] ?? 0,
    uvIndexMax: d.uv_index_max[i] ?? 0,
    sunrise: d.sunrise[i],
    sunset: d.sunset[i],
  }));

  return {
    timezone: data.timezone,
    current: {
      time: c.time,
      temp: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      conditionCode: c.weather_code,
      windSpeed: c.wind_speed_10m,
      windGusts: c.wind_gusts_10m,
      windDirection: c.wind_direction_10m,
      humidity: c.relative_humidity_2m,
      precipitation: c.precipitation,
      pressure: c.pressure_msl,
      cloudCover: c.cloud_cover,
      uvIndex: c.uv_index ?? 0,
      isDay: c.is_day === 1,
    },
    hourly,
    daily,
  };
}

export async function fetchAirQuality(lat: number, lon: number, signal?: AbortSignal): Promise<AirQuality | null> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'us_aqi,pm2_5,pm10',
  });
  try {
    const data = await getJson<any>(`${AIR_QUALITY_URL}?${params}`, signal);
    if (data?.current?.us_aqi == null) return null;
    return { usAqi: data.current.us_aqi, pm25: data.current.pm2_5, pm10: data.current.pm10 };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return null; // Air quality is optional; never block the page on it.
  }
}

export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string> {
  const params = new URLSearchParams({ format: 'json', lat: lat.toString(), lon: lon.toString(), zoom: '10' });
  const data = await getJson<any>(`${REVERSE_GEOCODING_URL}?${params}`, signal);
  const a = data.address ?? {};
  const place = a.city || a.town || a.village || a.suburb || a.county;
  if (!place) throw new Error('No place name');
  return [place, a.country].filter(Boolean).join(', ');
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationResult[]> {
  const params = new URLSearchParams({ name: query, count: '10', language: 'en', format: 'json' });
  const data = await getJson<any>(`${GEOCODING_URL}?${params}`, signal);
  if (!data.results) return [];
  return data.results.map((r: any) => ({
    lat: r.latitude,
    lon: r.longitude,
    name: r.name,
    country: r.country ?? '',
    admin1: r.admin1,
  }));
}

/** The same calendar days as the coming week, one year earlier. */
export async function fetchLastYear(
  lat: number,
  lon: number,
  dates: string[],
  signal?: AbortSignal,
): Promise<HistoricalData> {
  const shift = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: shift(dates[0]),
    end_date: shift(dates[dates.length - 1]),
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
  });
  const data = await getJson<any>(`${ARCHIVE_URL}?${params}`, signal);
  return {
    dates,
    lastYearMax: data.daily.temperature_2m_max,
    lastYearMin: data.daily.temperature_2m_min,
  };
}

export function formatLocation(loc: Pick<LocationResult, 'name' | 'admin1' | 'country'>): string {
  return [loc.name, loc.admin1, loc.country].filter(Boolean).join(', ');
}
