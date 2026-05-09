/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// We use Open-Meteo because it's high quality, open source, and requires no API key.
const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

export interface HistoricalData {
  time: string[];
  maxTemp: number[];
  minTemp: number[];
  avgTemp: number[];
}

export interface WeatherData {
  current: {
    temp: number;
    description: string;
    conditionCode: number;
    windSpeed: number;
    windDirection: number;
    humidity: number;
    uvIndex: number;
    isDay: boolean;
  };
  daily: {
    time: string[];
    maxTemp: number[];
    minTemp: number[];
    conditionCode: number[];
  }[];
  hourly: {
    time: string[];
    temp: number[];
    feelsLike: number[];
    windSpeed: number[];
    windDirection: number[];
    conditionCode: number[];
  };
  city?: string;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    hourly: "temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code",
    timezone: "auto",
    forecast_days: "1"
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch weather data");

  const data = await response.json();
  const current = data.current;

  // We need 24h of data for the chart
  const hourly = {
    time: data.hourly.time.slice(0, 24),
    temp: data.hourly.temperature_2m.slice(0, 24),
    feelsLike: data.hourly.apparent_temperature.slice(0, 24),
    windSpeed: data.hourly.wind_speed_10m.slice(0, 24),
    windDirection: data.hourly.wind_direction_10m.slice(0, 24),
    conditionCode: data.hourly.weather_code.slice(0, 24),
  };

  return {
    current: {
      temp: current.temperature_2m,
      description: getWeatherDescription(current.weather_code),
      conditionCode: current.weather_code,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      humidity: current.relative_humidity_2m,
      uvIndex: current.uv_index,
      isDay: current.is_day === 1,
    },
    daily: data.daily.time.map((time: string, i: number) => ({
      time,
      maxTemp: [data.daily.temperature_2m_max[i]], // Wrap in array as expected by previous interface design
      minTemp: [data.daily.temperature_2m_min[i]],
      conditionCode: [data.daily.weather_code[i]],
    })),
    hourly
  };
}

export function getWeatherDescription(code: number): string {
  const codes: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
  };
  return codes[code] || "Unknown";
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const data = await response.json();
    return data.address.city || data.address.town || data.address.village || data.address.suburb || "Unknown Location";
  } catch {
    return "Your Location";
  }
}

export interface LocationResult {
  lat: number;
  lon: number;
  name: string;
  country: string;
  admin1?: string;
}

export async function searchLocations(query: string): Promise<LocationResult[]> {
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=20&language=en&format=json`);
    const data = await response.json();
    if (!data.results) return [];
    return data.results.map((result: any) => ({
      lat: result.latitude,
      lon: result.longitude,
      name: result.name,
      country: result.country,
      admin1: result.admin1
    }));
  } catch {
    return [];
  }
}

export async function searchLocation(query: string): Promise<{ lat: number, lon: number, name: string } | null> {
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;
    const result = data.results[0];
    return {
      lat: result.latitude,
      lon: result.longitude,
      name: result.name + (result.admin1 ? `, ${result.admin1}` : '') + `, ${result.country}`
    };
  } catch {
    return null;
  }
}

export async function fetchHistoricalWeather(lat: number, lon: number, daysAgo: number = 365, range: number = 7): Promise<HistoricalData> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - daysAgo);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - range);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    daily: "temperature_2m_max,temperature_2m_min,temperature_2m_mean",
    timezone: "auto"
  });

  const response = await fetch(`${ARCHIVE_URL}?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch historical data");

  const data = await response.json();
  
  return {
    time: data.daily.time,
    maxTemp: data.daily.temperature_2m_max,
    minTemp: data.daily.temperature_2m_min,
    avgTemp: data.daily.temperature_2m_mean,
  };
}
