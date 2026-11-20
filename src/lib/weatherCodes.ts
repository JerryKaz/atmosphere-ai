export type IconKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

interface CodeInfo {
  label: string;
  icon: IconKind;
}

// WMO weather interpretation codes, as used by Open-Meteo.
const CODES: Record<number, CodeInfo> = {
  0: { label: 'Clear sky', icon: 'clear' },
  1: { label: 'Mainly clear', icon: 'partly' },
  2: { label: 'Partly cloudy', icon: 'partly' },
  3: { label: 'Overcast', icon: 'cloudy' },
  45: { label: 'Fog', icon: 'fog' },
  48: { label: 'Freezing fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'drizzle' },
  53: { label: 'Drizzle', icon: 'drizzle' },
  55: { label: 'Dense drizzle', icon: 'drizzle' },
  56: { label: 'Freezing drizzle', icon: 'drizzle' },
  57: { label: 'Heavy freezing drizzle', icon: 'drizzle' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  66: { label: 'Freezing rain', icon: 'rain' },
  67: { label: 'Heavy freezing rain', icon: 'rain' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Light showers', icon: 'rain' },
  81: { label: 'Showers', icon: 'rain' },
  82: { label: 'Violent showers', icon: 'rain' },
  85: { label: 'Snow showers', icon: 'snow' },
  86: { label: 'Heavy snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Severe thunderstorm with hail', icon: 'storm' },
};

export function describeCode(code: number): string {
  return CODES[code]?.label ?? 'Unknown';
}

export function iconForCode(code: number): IconKind {
  return CODES[code]?.icon ?? 'cloudy';
}

export interface SevereAlert {
  title: string;
  message: string;
}

export function severeAlertFor(code: number): SevereAlert | null {
  if (code === 95 || code === 96 || code === 99)
    return { title: 'Thunderstorm', message: 'Lightning in the area. Stay indoors and away from open ground and tall objects.' };
  if (code === 82)
    return { title: 'Violent showers', message: 'Very heavy rain. Expect poor visibility and possible flash flooding.' };
  if (code === 75 || code === 86)
    return { title: 'Heavy snow', message: 'Heavy snowfall. Roads may be dangerous; travel only if necessary.' };
  if (code === 65 || code === 67 || code === 66 || code === 57)
    return { title: 'Heavy or freezing rain', message: 'Slippery surfaces and standing water likely. Take care outdoors.' };
  return null;
}
