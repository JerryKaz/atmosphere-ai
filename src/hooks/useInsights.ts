import { useCallback, useEffect, useRef, useState } from 'react';
import { describeAiError, getWeatherInsights, type WeatherInsight } from '../services/geminiService';
import type { WeatherData } from '../services/weatherService';
import { describeCode } from '../lib/weatherCodes';

export function useInsights(weather: WeatherData | null) {
  const [insight, setInsight] = useState<WeatherInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const run = useCallback(
    async (force = false) => {
      if (!weather) return;
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      const c = weather.current;
      const nextHours = weather.hourly.slice(0, 6).map((h) => h.precipProbability);
      try {
        const result = await getWeatherInsights(
          {
            temp: Math.round(c.temp),
            feelsLike: Math.round(c.feelsLike),
            description: describeCode(c.conditionCode),
            isDay: c.isDay,
            windSpeed: Math.round(c.windSpeed),
            humidity: c.humidity,
            uvIndex: Math.round(c.uvIndex),
            precipProbability: Math.max(0, ...nextHours),
          },
          { force },
        );
        if (id === requestId.current) setInsight(result);
      } catch (err) {
        if (id === requestId.current) {
          setInsight(null);
          setError(describeAiError(err));
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [weather],
  );

  useEffect(() => {
    run();
  }, [run]);

  return { insight, loading, error, regenerate: () => run(true) };
}
