import { useEffect, useState, useMemo, type FormEvent, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Fuse from 'fuse.js';
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from 'recharts';
import { 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudSun, 
  Droplets, 
  Navigation, 
  Search, 
  Sun, 
  Moon,
  Thermometer, 
  Wind, 
  AlertCircle,
  Sparkles,
  Shirt,
  Calendar,
  CloudLightning,
  CloudFog,
  Wind as WindIcon,
  MapPin,
  RefreshCw,
  X,
  History,
  Share,
  WifiOff
} from 'lucide-react';
import { fetchWeather, reverseGeocode, searchLocation, searchLocations, fetchHistoricalWeather, type WeatherData, type HistoricalData, type LocationResult } from './services/weatherService';
import { getWeatherInsights, type WeatherInsight } from './services/geminiService';

// Fallback coordinates (London) if geolocation fails
const DEFAULT_COORDS = { lat: 51.5074, lon: -0.1278 };

export default function App() {
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [insights, setInsights] = useState<WeatherInsight | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [cityName, setCityName] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [weatherAlert, setWeatherAlert] = useState<{ title: string, message: string } | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<LocationResult[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isDataFromCache, setIsDataFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Theme state
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Try to restore from cache on initial mount if we have nothing
    const cachedWeather = localStorage.getItem('atmosphere_cached_weather');
    const cachedCity = localStorage.getItem('atmosphere_cached_city');
    const cachedInsights = localStorage.getItem('atmosphere_cached_insights');
    const cachedLastUpdated = localStorage.getItem('atmosphere_last_updated');
    
    if (cachedLastUpdated) setLastUpdated(cachedLastUpdated);

    if (cachedWeather && cachedCity) {
      setWeather(JSON.parse(cachedWeather));
      setCityName(cachedCity);
      if (cachedInsights) setInsights(JSON.parse(cachedInsights));
      setIsDataFromCache(true);
      setIsLoading(false);
    }
    
    // Load recent searches
    const savedRecent = localStorage.getItem('atmosphere_recent_searches');
    if (savedRecent) {
      try {
        setRecentSearches(JSON.parse(savedRecent));
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Initial geolocation request
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (err) => {
          let msg = "Geolocation disabled. Using default location.";
          if (err.code === 1) msg = "Location access denied. Displaying default observatory data.";
          if (err.code === 2) msg = "Network error while locating. Using default position.";
          if (err.code === 3) msg = "Location request timed out. Reverting to default.";
          setError(msg);
          setCoords(DEFAULT_COORDS);
        },
        { timeout: 10000 }
      );
    }
  }, []);

  const loadData = async (lat: number, lon: number, customName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [weatherData, name] = await Promise.all([
        fetchWeather(lat, lon).catch(err => {
          throw new Error(`Weather Data: ${err.message}`);
        }),
        customName ? Promise.resolve(customName) : reverseGeocode(lat, lon).catch(err => {
          console.warn("Geocoding failed, using coordinates", err);
          return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
        })
      ]);
      
      setWeather(weatherData);
      setCityName(name);
      setIsDataFromCache(false);
      
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setLastUpdated(timestamp);

      // Save to cache
      localStorage.setItem('atmosphere_cached_weather', JSON.stringify(weatherData));
      localStorage.setItem('atmosphere_cached_city', name);
      localStorage.setItem('atmosphere_last_updated', timestamp);

      // Check for severe weather alerts
      const code = weatherData.current.conditionCode;
      let alert = null;
      if (code === 95 || code === 96 || code === 99) {
        alert = { title: "Electrical Intensity", message: "Thunderstorms detected in the local atmosphere. Seek immediate shelter." };
      } else if (code === 82) {
        alert = { title: "Atmospheric Turbulence", message: "Violent precipitation levels detected. Reduced visibility and flood risk." };
      } else if (code === 75 || code === 86) {
        alert = { title: "Cryogenic Alert", message: "Heavy snowfall and blizzard conditions in effect. Exercise extreme caution." };
      } else if (code === 65 || code === 67) {
        alert = { title: "Saturation Warning", message: "Heavy precipitation in progress. Atmospheric density is critical." };
      }

      if (alert) {
        setWeatherAlert(alert);
        setShowAlert(true);
      } else {
        setWeatherAlert(null);
        setShowAlert(false);
      }
      
      // Separate AI insights fetch so it doesn't block weather display on failure
      try {
        const aiInsights = await getWeatherInsights(
          weatherData.current.temp,
          weatherData.current.description,
          weatherData.current.isDay,
          weatherData.current.windSpeed,
          weatherData.current.uvIndex
        );
        setInsights(aiInsights);
        localStorage.setItem('atmosphere_cached_insights', JSON.stringify(aiInsights));
      } catch (aiErr) {
        // Fallback already handled in service, but we catch just in case of primitive failures
        console.warn("AI Insight component synchronization issue.");
      }
    } catch (err: any) {
      // Try to load fallback from cache if fetch fails
      const cachedWeather = localStorage.getItem('atmosphere_cached_weather');
      const cachedCity = localStorage.getItem('atmosphere_cached_city');
      
      if (cachedWeather && cachedCity) {
        setWeather(JSON.parse(cachedWeather));
        setCityName(cachedCity);
        setIsDataFromCache(true);
        setError("Atmospheric server unreachable. Viewing recently syncronized records.");
      } else {
        if (err.message.includes("Weather Data")) {
          setError("Failed to synchronize with atmospheric data servers.");
        } else {
          setError("An unexpected error occurred while retrieving weather records.");
        }
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    if (historicalData) {
      setShowHistorical(!showHistorical);
      return;
    }

    setIsHistoricalLoading(true);
    try {
      const data = await fetchHistoricalWeather(coords.lat, coords.lon);
      setHistoricalData(data);
      setShowHistorical(true);
    } catch (err) {
      setError("Historical archive access failed. The temporal records are unreachable.");
      console.error(err);
    } finally {
      setIsHistoricalLoading(false);
    }
  };

  useEffect(() => {
    loadData(coords.lat, coords.lon);
    setHistoricalData(null); // Reset when location changes
    setShowHistorical(false);
  }, [coords]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    try {
      const apiResults = await searchLocations(searchQuery);
      if (apiResults && apiResults.length > 0) {
        // Apply client-side fuzzy ranking to the API results
        const fuse = new Fuse(apiResults, {
          keys: ['name', 'admin1', 'country'],
          threshold: 0.4,
          includeScore: true
        });
        
        const fuzzyResults = fuse.search(searchQuery);
        
        // If fuzzy matching found something, use it, otherwise fallback to API order
        const finalResults = fuzzyResults.length > 0 
          ? fuzzyResults.map(r => r.item) 
          : apiResults;

        setSearchResults(finalResults.slice(0, 6)); // Limit to top 6
        setShowSearchDropdown(true);
      } else {
        setError(`Zero results found for "${searchQuery}".`);
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    } catch (err) {
      setError("Search service interruption. Please try again later.");
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleShare = async () => {
    if (!weather || !insights) return;

    const shareText = `Current atmospheric state in ${cityName}:\n` +
      `🌡️ ${Math.round(weather.current.temp)}°C and ${weather.current.description}\n` +
      `✨ Atmosphere AI Recommendation: "${insights.outfit}"\n` +
      `Check it out at Atmosphere AI!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Atmospheric Intelligence: ${cityName}`,
          text: shareText,
          url: window.location.origin,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Shared synchronization failed:", err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${window.location.origin}`);
        alert("Atmospheric data copied to clipboard!");
      } catch (err) {
        console.error("Manual data extraction failed:", err);
      }
    }
  };

  const handleSelectLocation = (location: LocationResult) => {
    setCoords({ lat: location.lat, lon: location.lon });
    setCityName(`${location.name}${location.admin1 ? `, ${location.admin1}` : ''}, ${location.country}`);
    
    // Update recent searches
    setRecentSearches(prev => {
      // Remove if already exists to move to top
      const filtered = prev.filter(item => 
        !(item.lat === location.lat && item.lon === location.lon)
      );
      const updated = [location, ...filtered].slice(0, 5);
      localStorage.setItem('atmosphere_recent_searches', JSON.stringify(updated));
      return updated;
    });

    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  const bgGradient = useMemo(() => {
    if (!weather) return 'from-slate-900 to-black';
    const { conditionCode, isDay } = weather.current;
    
    if (!isDay) return 'from-indigo-950 via-slate-900 to-black';
    if (conditionCode === 0) return 'from-sky-400 via-blue-500 to-indigo-600';
    if (conditionCode < 3) return 'from-blue-300 via-blue-400 to-blue-600';
    if (conditionCode < 50) return 'from-slate-400 via-gray-500 to-slate-700';
    if (conditionCode < 70) return 'from-blue-600 via-indigo-700 to-slate-800';
    if (conditionCode < 80) return 'from-blue-50 via-slate-200 to-blue-200';
    return 'from-violet-900 via-slate-900 to-black';
  }, [weather]);

  const WeatherIcon = ({ code, isDay, size = 24, className = "" }: { code: number, isDay: boolean, size?: number, className?: string }) => {
    // Animation variants
    const sunVariants = {
      animate: {
        rotate: 360,
        scale: [1, 1.08, 1],
        opacity: [0.8, 1, 0.8],
        filter: ["brightness(1)", "brightness(1.4)", "brightness(1)"],
        transition: {
          rotate: { duration: 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          opacity: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          filter: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }
      }
    };

    const cloudSwayVariants = {
      animate: {
        x: [0, 5, 0],
        rotate: [0, 1, 0, -1, 0],
        transition: {
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    const rainVariants = {
      animate: {
        y: [0, 3, 0],
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    const fogPulseVariants = {
      animate: {
        opacity: [0.6, 0.9, 0.6],
        scale: [0.98, 1.02, 0.98],
        transition: {
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    const snowDriftVariants = {
      animate: {
        opacity: [0.7, 1, 0.7],
        x: [-3, 3, -3],
        y: [0, 2, 0],
        transition: {
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    const lightningVariants = {
      animate: {
        opacity: [1, 0.4, 1, 0.6, 1],
        transition: {
          duration: 0.4,
          repeat: Infinity,
          repeatDelay: 4
        }
      }
    };

    if (code === 0) return (
      <motion.div variants={sunVariants} animate="animate">
        {isDay ? <Sun size={size} className={`text-yellow-300 ${className}`} /> : <Moon size={size} className={`text-indigo-400 opacity-60 ${className}`} />}
      </motion.div>
    );
    
    if (code < 3) return (
      <motion.div variants={cloudSwayVariants} animate="animate">
        <CloudSun size={size} className={`text-blue-200 ${className}`} />
      </motion.div>
    );

    if (code === 45 || code === 48) return (
      <motion.div variants={fogPulseVariants} animate="animate">
        <CloudFog size={size} className={`text-slate-300/50 ${className}`} />
      </motion.div>
    );
    
    if (code < 50) return (
      <motion.div variants={cloudSwayVariants} animate="animate">
        <Cloud size={size} className={`text-slate-200 ${className}`} />
      </motion.div>
    );
    
    if (code < 70) return (
      <motion.div variants={rainVariants} animate="animate">
        <CloudRain size={size} className={`text-blue-400 ${className}`} />
      </motion.div>
    );
    
    if (code < 80) return (
      <motion.div variants={snowDriftVariants} animate="animate">
        <CloudSnow size={size} className={`text-blue-100 ${className}`} />
      </motion.div>
    );
    
    if (code < 90) return (
      <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
        <Droplets size={size} className={`text-blue-500 ${className}`} />
      </motion.div>
    );
    
    return (
      <motion.div variants={lightningVariants} animate="animate">
        <CloudLightning size={size} className={`text-yellow-400 ${className}`} />
      </motion.div>
    );
  };

  const getCardinalDirection = (angle: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(angle / 45) % 8];
  };

  const AITooltip = ({ children, content }: { children: ReactNode, content: string }) => {
    const [show, setShow] = useState(false);
    return (
      <div className="relative inline-block w-full" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
        {children}
        <AnimatePresence>
          {show && content && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              className="absolute z-[100] bottom-full left-0 mb-3 w-64 p-3 bg-natural-sage/95 backdrop-blur-sm text-white rounded-xl shadow-xl text-[10px] leading-relaxed pointer-events-none border border-white/20"
            >
              <div className="flex items-start gap-2">
                <Sparkles size={12} className="shrink-0 mt-0.5" />
                <p>{content}</p>
              </div>
              <div className="absolute top-full left-4 -mt-1 border-[6px] border-transparent border-t-natural-sage/95" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const historicalTrendData = useMemo(() => {
    if (!historicalData) return [];
    return historicalData.time.map((time, i) => ({
      date: new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      max: historicalData.maxTemp[i],
      min: historicalData.minTemp[i],
      avg: historicalData.avgTemp[i],
    }));
  }, [historicalData]);

  const trendData = useMemo(() => {
    if (!weather) return [];
    return weather.hourly.time.map((time, i) => ({
      time: new Date(time).getHours() + ':00',
      temp: weather.hourly.temp[i],
      conditionCode: weather.hourly.conditionCode[i],
      feelsLike: weather.hourly.feelsLike ? weather.hourly.feelsLike[i] : null,
      windSpeed: weather.hourly.windSpeed ? weather.hourly.windSpeed[i] : null,
      windDirection: weather.hourly.windDirection ? weather.hourly.windDirection[i] : null,
    }));
  }, [weather]);

  if (isLoading && !weather) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black font-sans">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="text-white/20" size={48} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-1000 bg-natural-bg font-sans p-4 sm:p-8 md:p-12 flex flex-col items-center overflow-x-hidden text-natural-ink">
      {/* Header */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row justify-between items-start mb-12 sm:mb-16 gap-6 sm:gap-8">
        <div className="flex flex-col">
          <h1 className="font-serif text-3xl sm:text-4xl md:text-6xl font-semibold leading-tight tracking-tight max-w-full">
            {cityName.split(',')[0]}<span className="italic">, {cityName.split(',').slice(1).join(',')}</span>
          </h1>
          <p className="text-[10px] sm:text-xs opacity-40 mt-2 sm:mt-3 font-bold tracking-widest uppercase">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            {isOffline && (
              <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-500 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all">
                <WifiOff size={11} className="animate-pulse" />
                <span>Offline{lastUpdated ? ` • Sync: ${lastUpdated}` : ''}</span>
              </div>
            )}
            {isDataFromCache && !isOffline && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                <RefreshCw size={10} className="animate-spin" />
                Cached Records
              </div>
            )}
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-2.5 sm:p-3 rounded-full border border-natural-ink/10 hover:bg-white dark:hover:bg-natural-ink/20 transition-all text-natural-sage shadow-sm flex items-center justify-center shrink-0"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="pill whitespace-nowrap">Live Updates</div>
            <button 
              onClick={loadHistoricalData}
              disabled={isHistoricalLoading}
              className={`p-2.5 sm:p-3 rounded-full border border-natural-ink/10 hover:bg-white dark:hover:bg-natural-ink/20 transition-all text-natural-sage shadow-sm flex items-center justify-center shrink-0 ${showHistorical ? 'bg-natural-sage/20 border-natural-sage/40' : ''}`}
              title="Atmospheric Archive (Last Year)"
            >
              <Calendar size={18} className={isHistoricalLoading ? 'animate-pulse' : ''} />
            </button>
            <button 
              onClick={() => loadData(coords.lat, coords.lon)} 
              className="p-2.5 sm:p-3 rounded-full border border-natural-ink/10 hover:bg-white dark:hover:bg-natural-ink/20 transition-all text-natural-sage shadow-sm flex items-center justify-center shrink-0"
              title="Refresh Atmosphere"
            >
              <RefreshCw size={18} />
            </button>
            <button 
              onClick={handleShare}
              className="p-2.5 sm:p-3 rounded-full border border-natural-ink/10 hover:bg-white dark:hover:bg-natural-ink/20 transition-all text-natural-sage shadow-sm flex items-center justify-center shrink-0"
              title="Share Atmospheric Insights"
            >
              <Share size={18} />
            </button>
          </div>
          
          <div className="relative w-full sm:w-64" role="search">
            <form onSubmit={handleSearch} className="relative w-full">
              <input 
                type="text" 
                placeholder="Locate atmosphere..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search for a city or coordinate"
                className="w-full bg-white rounded-full py-2.5 pl-11 pr-4 border border-natural-ink/5 focus:outline-none focus:ring-2 focus:ring-natural-sage/20 transition-all text-sm placeholder:text-natural-ink/20 shadow-sm"
              />
              <button 
                type="submit" 
                aria-label="Submit location search"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-natural-sage hover:scale-110 transition-transform cursor-pointer"
              >
                {isSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
              {searchQuery === '' && recentSearches.length > 0 && (
                <button 
                  type="button"
                  onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-natural-sage/40 hover:text-natural-sage transition-colors"
                  title="View Recent Atmospheres"
                >
                  <History size={16} />
                </button>
              )}
            </form>

            <AnimatePresence>
              {showSearchDropdown && (searchResults.length > 0 || (searchQuery === '' && recentSearches.length > 0)) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-natural-bg/95 backdrop-blur-md rounded-2xl border border-natural-ink/5 shadow-2xl overflow-hidden"
                >
                  <div className="p-2">
                    {(searchQuery === '' ? recentSearches : searchResults).map((result, idx) => (
                      <button
                        key={`${result.lat}-${result.lon}-${idx}`}
                        onClick={() => handleSelectLocation(result)}
                        className="w-full text-left px-4 py-3 hover:bg-natural-bg dark:hover:bg-natural-ink/10 rounded-xl transition-colors flex items-center gap-3 group"
                      >
                        <MapPin size={14} className="text-natural-sage opacity-40 group-hover:opacity-100 transition-opacity" />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{result.name}</span>
                          <span className="text-[10px] opacity-40 uppercase tracking-wider font-bold">
                            {result.admin1 ? `${result.admin1}, ` : ''}{result.country}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="bg-natural-bg p-2 text-center border-t border-natural-ink/5 flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold tracking-widest opacity-30 ml-2">
                      {searchQuery === '' ? 'Recent Atmospheres' : 'Potential Atmospheric Points'}
                    </span>
                    <button 
                      onClick={() => setShowSearchDropdown(false)}
                      className="p-1 px-2 hover:bg-natural-ink/5 rounded-lg text-xs opacity-40"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showAlert && weatherAlert && (
          <motion.div 
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="w-full max-w-6xl mb-8"
          >
            <div className="relative overflow-hidden bg-rose-500/10 border border-rose-500/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-2xl shadow-rose-500/5 group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CloudLightning size={100} className="text-rose-500" />
              </div>
              
              <div className="bg-rose-500 text-white p-4 rounded-2xl shadow-lg shrink-0 animate-pulse">
                <AlertCircle size={32} />
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-rose-500 font-serif text-xl sm:text-2xl font-bold mb-2 tracking-tight">
                  {weatherAlert.title}
                </h3>
                <p className="text-natural-ink/80 text-sm sm:text-base font-medium leading-relaxed max-w-2xl">
                  {weatherAlert.message}
                </p>
              </div>

              <button 
                onClick={() => setShowAlert(false)}
                className="p-2 sm:p-3 rounded-full hover:bg-rose-500/10 transition-colors text-rose-500 shrink-0"
              >
                <X size={24} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full max-w-6xl mb-8 flex justify-center"
          >
             <div className="bg-natural-clay/20 border border-natural-clay/30 rounded-2xl px-5 py-3 flex items-center gap-3 w-full sm:w-auto">
                <AlertCircle size={18} className="text-natural-clay shrink-0" />
                <p className="text-xs sm:text-sm font-medium text-natural-ink/80">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto sm:ml-2 hover:text-natural-ink transition-colors">
                  <X size={14} />
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full max-w-6xl flex flex-col gap-8 md:gap-12">
        
        <AnimatePresence>
          {showHistorical && historicalData && (
            <motion.section 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <div className="card p-6 sm:p-8 border border-natural-sage/30 bg-natural-sage/5">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <History size={20} className="text-natural-sage" />
                    <h3 className="font-serif text-xl sm:text-2xl">Atmospheric Archive: One Year Ago</h3>
                  </div>
                  <button 
                    onClick={() => setShowHistorical(false)}
                    className="text-natural-sage hover:text-natural-ink transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="h-[200px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historicalTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E6BA95" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#E6BA95" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? '#242B22' : '#fff', 
                          border: '1px solid rgba(230, 186, 149, 0.3)', 
                          borderRadius: '16px', 
                          fontSize: '11px',
                          padding: '10px',
                        }}
                        itemStyle={{ color: isDark ? '#F1F3EF' : '#2C332A', fontWeight: 600 }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className={`border border-natural-clay/30 p-3 rounded-2xl shadow-xl text-[10px] sm:text-xs flex flex-col gap-1 ${isDark ? 'bg-[#242B22]' : 'bg-white'}`}>
                                <p className="font-bold opacity-40 mb-1">{label}, {new Date().getFullYear() - 1}</p>
                                <p className="font-semibold text-natural-clay">Avg: {data.avg.toFixed(1)}°C</p>
                                <p className="opacity-60">High: {data.max.toFixed(1)}°C</p>
                                <p className="opacity-60">Low: {data.min.toFixed(1)}°C</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: isDark ? '#F1F3EF' : '#2C332A', opacity: 0.3, fontSize: 10 }}
                      />
                      <YAxis hide={true} domain={['auto', 'auto']} />
                      <Area 
                        type="monotone" 
                        dataKey="avg" 
                        stroke="#E6BA95" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#histGradient)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-30 mt-4 text-center">
                  Retrospective comparison for the corresponding lunar segment
                </p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Main Weather Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-center">
          <section className="lg:col-span-8 flex flex-col sm:flex-row items-center sm:items-start lg:items-center gap-8 sm:gap-12 lg:gap-16">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-baseline gap-4 sm:gap-6"
            >
              <h2 className="font-serif text-[100px] sm:text-[140px] md:text-[180px] leading-none font-light tracking-tighter">
                {Math.round(weather?.current.temp ?? 0)}°
              </h2>
              <div className="flex flex-col mb-4 sm:mb-8 md:mb-10">
                <span className="font-serif text-2xl sm:text-4xl md:text-5xl italic text-natural-sage leading-tight">
                  {weather?.current.description}
                </span>
                <span className="text-base sm:text-lg md:text-xl opacity-40 font-medium tracking-tight">
                  Feels like {Math.round((weather?.current.temp ?? 0) - 1)}°
                </span>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 sm:flex sm:flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-12 w-full sm:w-auto">
              <div className="stat-box">
                <p className="text-[10px] uppercase opacity-40 font-bold mb-1 tracking-widest">Wind Velocity</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg sm:text-xl md:text-2xl font-medium">
                    {weather?.current.windSpeed} <span className="text-xs sm:text-sm opacity-40">km/h</span>
                  </p>
                  {weather && (
                    <div 
                      className="text-natural-sage transition-transform duration-1000"
                      style={{ transform: `rotate(${weather.current.windDirection}deg)` }}
                    >
                      <Navigation size={14} fill="currentColor" className="opacity-60" />
                    </div>
                  )}
                  <span className="text-natural-sage text-[10px] sm:text-xs font-semibold opacity-60">
                    {weather ? getCardinalDirection(weather.current.windDirection) : ''}
                  </span>
                </div>
              </div>
              <div className="stat-box">
                <p className="text-[10px] uppercase opacity-40 font-bold mb-1 tracking-widest">Humidity</p>
                <p className="text-lg sm:text-xl md:text-2xl font-medium">{weather?.current.humidity}%</p>
              </div>
              <div className="stat-box hidden sm:block">
                <p className="text-[10px] uppercase opacity-40 font-bold mb-1 tracking-widest">Precipitation</p>
                <p className="text-lg sm:text-xl md:text-2xl font-medium">0.2 <span className="text-xs sm:text-sm opacity-40">mm</span></p>
              </div>
            </div>
          </section>

          {/* AI Advisor Card */}
          <section className="lg:col-span-4 self-stretch">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card h-full p-6 sm:p-8 flex flex-col relative overflow-hidden group border border-white"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles size={120} className="text-natural-sage" />
              </div>

              <h3 className="font-serif text-xl sm:text-2xl mb-6 sm:mb-8 border-b border-natural-bg pb-4">Atmosphere AI Advisor</h3>
              
              <div className="space-y-6 sm:space-y-8 flex-1">
                <div>
                  <div className="flex items-center gap-2 text-natural-sage text-[10px] uppercase font-bold tracking-widest mb-2 sm:mb-3">
                    <Shirt size={14} />
                    <span>Selected Attire</span>
                  </div>
                  <AITooltip content={insights?.outfitReason || ""}>
                    <p className="text-base sm:text-lg font-medium leading-snug cursor-help">
                      {insights ? insights.outfit : "Crafting visual harmony..."}
                    </p>
                  </AITooltip>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-natural-sage text-[10px] uppercase font-bold tracking-widest mb-2 sm:mb-3">
                    <Calendar size={14} />
                    <span>Curated Activities</span>
                  </div>
                  <AITooltip content={insights?.activitiesReason || ""}>
                    <ul className="flex flex-wrap gap-2 cursor-help">
                      {insights ? insights.activities.map((act, i) => (
                        <li key={i} className="px-3 py-1 bg-natural-bg rounded-lg text-[10px] sm:text-xs font-medium border border-natural-ink/5">
                          {act}
                        </li>
                      )) : [1, 2].map(i => <li key={i} className="w-20 h-5 bg-natural-bg/50 animate-pulse rounded-full" />)}
                    </ul>
                  </AITooltip>
                </div>

                {insights?.summary && (
                  <div className="mt-2 italic text-xs sm:text-sm text-natural-sage/80 leading-relaxed border-t border-natural-bg pt-4">
                    "{insights.summary}"
                  </div>
                )}
              </div>
            </motion.div>
          </section>
        </div>

        {/* Forecast and Chart Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Daily Outlook Card */}
          <section className="lg:col-span-4 order-2 lg:order-1">
            <div className="card p-6 sm:p-8 border border-white h-full flex flex-col">
              <h3 className="font-serif text-xl sm:text-2xl mb-6">Weekly Outlook</h3>
              
              {/* Hourly Current Day Strip */}
              <div className="mb-8 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide">
                <div className="flex gap-4 min-w-max">
                  {trendData.slice(0, 12).map((hour, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-natural-bg/30 border border-natural-ink/5 min-w-[60px]">
                      <span className="text-[10px] font-bold opacity-40">{hour.time}</span>
                      <WeatherIcon 
                        code={hour.conditionCode} 
                        isDay={parseInt(hour.time) >= 6 && parseInt(hour.time) <= 18} 
                        size={18} 
                        className="opacity-60" 
                      />
                      <span className="font-bold text-xs">{Math.round(hour.temp)}°</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5 sm:space-y-7 flex-1">
                {weather?.daily.map((day, i) => (
                  <div key={i} className="flex justify-between items-center group">
                    <span className="w-14 sm:w-16 font-medium text-xs sm:text-sm opacity-60">
                      {i === 0 ? "Today" : new Date(day.time).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <div className="flex-1 flex justify-center">
                      <WeatherIcon 
                        code={day.conditionCode[0]} 
                        isDay={true} 
                        size={18} 
                        className="opacity-40 group-hover:opacity-100 transition-opacity" 
                      />
                    </div>
                    <div className="flex gap-3 sm:gap-4 w-16 sm:w-20 justify-end">
                      <span className="font-semibold text-xs sm:text-sm">{Math.round(day.maxTemp[0])}°</span>
                      <span className="opacity-30 text-xs sm:text-sm">{Math.round(day.minTemp[0])}°</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-natural-bg flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-widest opacity-30">Air Clarity</span>
                  <span className="text-xs sm:text-sm font-semibold">Exceptional</span>
                </div>
                <div className="w-20 sm:w-24 h-1 bg-natural-bg rounded-full overflow-hidden">
                  <div className="w-4/5 h-full bg-natural-sage"></div>
                </div>
              </div>
            </div>
          </section>

          {/* Temperature Trend Area */}
          <section className="lg:col-span-8 order-1 lg:order-2 flex flex-col gap-6 sm:gap-8">
            <div className="card p-6 sm:p-8 flex-1 border border-white">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-10 gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-natural-sage animate-pulse" />
                  <h3 className="font-serif text-xl sm:text-2xl">Luminance & Thermal Shift</h3>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-30">Next 24 Hours</span>
              </div>
              
              <div className="h-[200px] sm:h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tempGradientNatural" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A7B09E" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#A7B09E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDark ? '#242B22' : '#fff', 
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee', 
                        borderRadius: '16px', 
                        fontSize: '11px',
                        padding: '10px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                      }}
                      itemStyle={{ color: isDark ? '#F1F3EF' : '#2C332A', fontWeight: 600 }}
                      labelFormatter={(label) => `Time: ${label}`}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className={`border p-3 rounded-2xl shadow-xl text-[10px] sm:text-xs flex flex-col gap-1 ${isDark ? 'bg-[#242B22] border-white/10' : 'bg-white border-black/5'}`}>
                              <p className="font-bold opacity-40 mb-1">{label}</p>
                              <p className="font-semibold">Temp: {Math.round(data.temp)}°C</p>
                              <p className="opacity-60">Feels: {Math.round(data.feelsLike)}°C</p>
                              <p className="opacity-60">
                                Wind: {data.windSpeed} km/h {data.windDirection !== null ? getCardinalDirection(data.windDirection) : ''}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: isDark ? '#F1F3EF' : '#2C332A', opacity: 0.3, fontSize: 10 }}
                      interval={3}
                    />
                    <YAxis 
                      hide={true}
                      domain={['auto', 'auto']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="temp" 
                      stroke="#A7B09E" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#tempGradientNatural)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex gap-4 h-28 sm:h-32 overflow-x-auto pb-4 scrollbar-hide px-1">
              {weather?.hourly.time.slice(0, 12).map((time, i) => (
                <div 
                  key={i} 
                  className={`flex-1 min-w-[90px] sm:min-w-[100px] card flex flex-col justify-center items-center gap-0.5 sm:gap-1 border hover:border-natural-sage transition-all cursor-default ${i === 0 ? 'bg-natural-ink text-natural-bg' : 'border-white'}`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${i === 0 ? 'opacity-60' : 'opacity-40'}`}>
                    {new Date(time).getHours()}:00
                  </span>
                  <span className="text-base sm:text-lg font-serif">
                    {Math.round(weather.hourly.temp[i])}°
                  </span>
                  <span className={`text-[9px] sm:text-[10px] ${i === 0 ? 'opacity-60' : 'opacity-40'}`}>
                    {i === 0 ? 'Current' : 'Outlook'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-12 sm:mt-16 pb-8 flex flex-col items-center gap-3 sm:gap-4 text-natural-ink/20 text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.3em] text-center">
        <div className="flex gap-4 sm:gap-8">
          <span>Atmosphere AI v2.0</span>
          <span>Earth Elements Dataset</span>
        </div>
        <p>© {new Date().getFullYear()} <a href="https://github.com/JerryKaz" target="_blank" rel="noopener noreferrer" className="hover:text-natural-ink/40 transition-colors">Jerry Myron</a> • Aesthetic Intelligence Laboratory</p>
      </footer>
    </div>
  );
}
