/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { readJson, writeJson } from '../lib/storage';

// NOTE: a key used in the browser is visible to anyone who opens DevTools.
// For production, move this call behind a small server function that holds
// the key, and point the app at that endpoint instead.
const API_KEY: string | undefined = import.meta.env.VITE_GEMINI_API_KEY;
const PLACEHOLDER_KEYS = new Set(['MY_GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY', '']);
const MODEL = 'gemini-3-flash-preview';
const CACHE_KEY = 'atmosphere_ai_cache';
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 20;

let client: GoogleGenAI | null = null;

export function isAiConfigured(): boolean {
  return !!API_KEY && !PLACEHOLDER_KEYS.has(API_KEY);
}

function getClient(): GoogleGenAI {
  if (!isAiConfigured()) throw new Error('AI_NOT_CONFIGURED');
  client ??= new GoogleGenAI({ apiKey: API_KEY! });
  return client;
}

export interface WeatherInsight {
  outfit: string;
  outfitReason: string;
  activities: string[];
  activitiesReason: string;
  alert?: string;
  summary: string;
}

export interface InsightInput {
  temp: number;
  feelsLike: number;
  description: string;
  isDay: boolean;
  windSpeed: number;
  humidity: number;
  uvIndex: number;
  precipProbability: number;
}

type CacheEntry = { at: number; value: WeatherInsight };

// Similar conditions get the same advice. Rounding the inputs means a refresh
// a few minutes later reuses the cached answer and does not spend quota.
function cacheKey(i: InsightInput): string {
  const r = (n: number, step: number) => Math.round(n / step) * step;
  return [
    r(i.feelsLike, 2),
    i.description,
    i.isDay ? 'd' : 'n',
    r(i.windSpeed, 10),
    r(i.uvIndex, 2),
    r(i.precipProbability, 25),
  ].join('|');
}

function isInsight(v: unknown): v is WeatherInsight {
  const o = v as WeatherInsight;
  return (
    !!o &&
    typeof o.outfit === 'string' &&
    typeof o.outfitReason === 'string' &&
    Array.isArray(o.activities) &&
    o.activities.every((a) => typeof a === 'string') &&
    typeof o.activitiesReason === 'string' &&
    typeof o.summary === 'string'
  );
}

/**
 * Returns AI advice for the given conditions, or throws. The caller shows an
 * honest "unavailable" state on failure instead of fake advice.
 */
export async function getWeatherInsights(input: InsightInput, { force = false } = {}): Promise<WeatherInsight> {
  const key = cacheKey(input);
  const cache = readJson<Record<string, CacheEntry>>(CACHE_KEY, {});
  const hit = cache[key];
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS && isInsight(hit.value)) return hit.value;

  const prompt = `Current weather:
- Temperature: ${input.temp}°C (feels like ${input.feelsLike}°C)
- Condition: ${input.description}
- Time of day: ${input.isDay ? 'daytime' : 'night'}
- Wind: ${input.windSpeed} km/h
- Humidity: ${input.humidity}%
- UV index: ${input.uvIndex}
- Chance of rain in the next few hours: ${input.precipProbability}%

Return JSON with:
- "outfit": one concrete clothing recommendation (layers, rain gear, sun protection when UV > 3).
- "outfitReason": one sentence explaining why.
- "activities": 2-3 short activity ideas (max 4 words each) that suit these conditions.
- "activitiesReason": one sentence explaining why.
- "alert": only if there is a real safety concern (UV > 6, strong wind, heat, storms); otherwise omit.
- "summary": one short, friendly sentence describing the day.`;

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          outfit: { type: Type.STRING },
          outfitReason: { type: Type.STRING },
          activities: { type: Type.ARRAY, items: { type: Type.STRING } },
          activitiesReason: { type: Type.STRING },
          alert: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['outfit', 'outfitReason', 'activities', 'activitiesReason', 'summary'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty AI response');
  const parsed: unknown = JSON.parse(text);
  if (!isInsight(parsed)) throw new Error('Malformed AI response');

  // Keep the cache small: newest entries win.
  const entries = Object.entries({ ...cache, [key]: { at: Date.now(), value: parsed } })
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, MAX_CACHE_ENTRIES);
  writeJson(CACHE_KEY, Object.fromEntries(entries));

  return parsed;
}

export function describeAiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'AI_NOT_CONFIGURED') return 'Add a Gemini API key to enable personalised advice.';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) return 'AI quota reached. Try again in a little while.';
  return 'AI advice is unavailable right now.';
}
