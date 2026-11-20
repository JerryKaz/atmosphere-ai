import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react';
import { iconForCode } from '../lib/weatherCodes';

interface Props {
  code: number;
  isDay: boolean;
  size?: number;
  animated?: boolean;
  className?: string;
}

const COLORS = {
  sun: 'text-amber-400',
  moon: 'text-indigo-400',
  cloud: 'text-slate-400',
  rain: 'text-sky-500',
  snow: 'text-sky-300',
  storm: 'text-violet-500',
};

export function WeatherIcon({ code, isDay, size = 24, animated = false, className = '' }: Props) {
  const reduce = useReducedMotion();
  const kind = iconForCode(code);
  const live = animated && !reduce;

  let Icon = Cloud;
  let color = COLORS.cloud;
  let animate: TargetAndTransition | undefined;
  let transition: Transition | undefined;

  switch (kind) {
    case 'clear':
      Icon = isDay ? Sun : Moon;
      color = isDay ? COLORS.sun : COLORS.moon;
      animate = isDay ? { rotate: 360 } : { opacity: [0.8, 1, 0.8] };
      transition = isDay ? { duration: 40, repeat: Infinity, ease: 'linear' } : { duration: 4, repeat: Infinity };
      break;
    case 'partly':
      Icon = isDay ? CloudSun : CloudMoon;
      color = isDay ? 'text-amber-400' : COLORS.moon;
      animate = { x: [0, 3, 0] };
      transition = { duration: 6, repeat: Infinity, ease: 'easeInOut' };
      break;
    case 'fog':
      Icon = CloudFog;
      animate = { opacity: [0.6, 1, 0.6] };
      transition = { duration: 4, repeat: Infinity };
      break;
    case 'drizzle':
      Icon = CloudDrizzle;
      color = COLORS.rain;
      animate = { y: [0, 2, 0] };
      transition = { duration: 2, repeat: Infinity, ease: 'easeInOut' };
      break;
    case 'rain':
      Icon = CloudRain;
      color = COLORS.rain;
      animate = { y: [0, 3, 0] };
      transition = { duration: 1.5, repeat: Infinity, ease: 'easeInOut' };
      break;
    case 'snow':
      Icon = CloudSnow;
      color = COLORS.snow;
      animate = { x: [-2, 2, -2] };
      transition = { duration: 5, repeat: Infinity, ease: 'easeInOut' };
      break;
    case 'storm':
      Icon = CloudLightning;
      color = COLORS.storm;
      animate = { opacity: [1, 0.4, 1] };
      transition = { duration: 0.4, repeat: Infinity, repeatDelay: 4 };
      break;
    default:
      animate = { x: [0, 3, 0] };
      transition = { duration: 8, repeat: Infinity, ease: 'easeInOut' };
  }

  const icon = <Icon size={size} className={`${color} ${className}`} strokeWidth={1.75} aria-hidden="true" />;
  if (!live) return icon;
  return (
    <motion.span className="inline-flex" animate={animate} transition={transition}>
      {icon}
    </motion.span>
  );
}
