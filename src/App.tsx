/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wind, 
  Thermometer, 
  Droplets, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Gauge, 
  CloudLightning, 
  MoveDown,
  MapPin,
  ChevronDown,
  X,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudDrizzle,
  CloudMoon,
  CloudHail,
  Waves,
  Moon,
  Haze as HazeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';

interface WeatherData {
  wind: string | null;
  temperature: string | null;
  humidity: string | null;
  pressure: string | null;
  wind_dir: number | null;
  phenomena: string | null;
  icon: string;
  is_day: boolean;
  timestamp: string;
}

const translatePhenomena = (code: string | null): string => {
  if (!code) return 'Brak';
  const clean = code.replace('+', 'Mocny ').replace('-', 'Lekki ').trim();
  const map: Record<string, string> = {
    'RA': 'Deszcz', 'SN': 'Śnieg', 'TS': 'Burza', 'FG': 'Mgła', 'BR': 'Zamglenie',
    'HZ': 'Zmętnienie', 'DZ': 'Mżawka', 'FU': 'Dym', 'DU': 'Pył', 'SA': 'Piasek',
    'GR': 'Grad', 'PL': 'Deszcz ze śniegiem', 'GS': 'Krupa śnieżna', 'VA': 'Popiół'
  };
  
  const core = Object.keys(map).find(k => clean.includes(k));
  if (core) return clean.replace(core, map[core]);
  return code;
};

const AIRPORTS = [
  { group: "Biała Podlaska", airports: [{ name: "Biała Podlaska", code: "EPBA" }] },
  { group: "Białystok", airports: [{ name: "Białystok-Krywlany", code: "EPBK" }] },
  { group: "Bydgoszcz", airports: [{ name: "Bydgoszcz-Szwederowo", code: "EPBY" }] },
  { group: "Częstochowa", airports: [{ name: "Częstochowa-Rudniki", code: "EPCZ" }] },
  { group: "Elbląg", airports: [{ name: "Elbląg", code: "EPEL" }] },
  { group: "Gdańsk", airports: [{ name: "Gdańsk im. Lecha Wałęsy", code: "EPGD" }] },
  { group: "Gliwice", airports: [{ name: "Gliwice", code: "EPGL" }] },
  { group: "Grudziądz", airports: [{ name: "Grudziądz (Lisia Góra)", code: "EPGI" }] },
  { group: "Inowrocław", airports: [{ name: "Inowrocław", code: "EPIR" }] },
  { group: "Jelenia Góra", airports: [{ name: "Jelenia Góra", code: "EPJS" }] },
  { group: "Katowice", airports: [{ name: "Katowice-Pyrzowice", code: "EPKT" }] },
  { group: "Kętrzyn", airports: [{ name: "Kętrzyn (Wilamowo)", code: "EPKW" }] },
  { group: "Kielce", airports: [{ name: "Kielce-Masłów", code: "EPKC" }] },
  { group: "Konin", airports: [{ name: "Konin (Kazimierz Biskupi)", code: "EPKB" }] },
  { group: "Kraków", airports: [{ name: "Kraków-Balice", code: "EPKK" }] },
  { group: "Krosno", airports: [{ name: "Krosno", code: "EPKR" }] },
  { group: "Leszno", airports: [{ name: "Leszno-Strzyżewice", code: "EPLS" }] },
  { group: "Lublin", airports: [{ name: "Port Lotniczy Lublin", code: "EPLB" }] },
  { group: "Łask", airports: [{ name: "Łask (Wojskowe)", code: "EPLK" }] },
  { group: "Łódź", airports: [{ name: "Łódź-Lublinek", code: "EPLL" }] },
  { group: "Malbork", airports: [{ name: "Malbork (Wojskowe)", code: "EPMB" }] },
  { group: "Mielec", airports: [{ name: "Mielec", code: "EPML" }] },
  { group: "Mińsk Mazowiecki", airports: [{ name: "Mińsk Maz. (Wojskowe)", code: "EPMM" }] },
  { group: "Mirosławiec", airports: [{ name: "Mirosławiec (Wojskowe)", code: "EPMI" }] },
  { group: "Nowy Sącz", airports: [{ name: "Nowy Sącz-Łososina", code: "EPNL" }] },
  { group: "Nowy Targ", airports: [{ name: "Nowy Targ", code: "EPNT" }] },
  { group: "Olsztyn", airports: [{ name: "Olsztyn-Mazury (Szymany)", code: "EPSY" }] },
  { group: "Opole", airports: [{ name: "Opole (Polska Nowa Wieś)", code: "EPOP" }] },
  { group: "Ostrów Wlkp.", airports: [{ name: "Ostrów Wlkp. (Michałków)", code: "EPOM" }] },
  { group: "Piła", airports: [{ name: "Piła", code: "EPPI" }] },
  { group: "Piotrków Tryb.", airports: [{ name: "Piotrków Trybunalski", code: "EPPT" }] },
  { group: "Płock", airports: [{ name: "Płock", code: "EPPL" }] },
  { group: "Poznań", airports: [{ name: "Poznań-Ławica", code: "EPPO" }] },
  { group: "Radom", airports: [{ name: "Radom-Warszawa", code: "EPRA" }] },
  { group: "Rybnik", airports: [{ name: "Rybnik (Gotartowice)", code: "EPRG" }] },
  { group: "Rzeszów", airports: [{ name: "Rzeszów-Jasionka", code: "EPRZ" }] },
  { group: "Słupsk", airports: [{ name: "Słupsk-Redzikowo", code: "EPSK" }] },
  { group: "Stalowa Wola", airports: [{ name: "Turbia-Stalowa Wola", code: "EPST" }] },
  { group: "Suwałki", airports: [{ name: "Suwałki", code: "EPSU" }] },
  { group: "Szczecin", airports: [{ name: "Szczecin-Goleniów", code: "EPSC" }] },
  { group: "Świdwin", airports: [{ name: "Świdwin (Wojskowe)", code: "EPSN" }] },
  { group: "Toruń", airports: [{ name: "Toruń", code: "EPTO" }] },
  { group: "Warszawa", airports: [
    { name: "Warszawa-Chopin", code: "EPWA" },
    { name: "Warszawa-Modlin", code: "EPMO" },
    { name: "Warszawa-Babice", code: "EPBC" }
  ]},
  { group: "Włocławek", airports: [{ name: "Włocławek (Kruszyn)", code: "EPWK" }] },
  { group: "Wrocław", airports: [{ name: "Wrocław-Strachowice", code: "EPWR" }] },
  { group: "Zamość", airports: [{ name: "Zamość (Mokre)", code: "EPZA" }] },
  { group: "Zielona Góra", airports: [{ name: "Zielona Góra-Babimost", code: "EPZG" }] }
];



export default function App() {
  const [data, setData] = useState<WeatherData | null>(() => {
    const saved = localStorage.getItem('weatherData');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapseSide, setCollapseSide] = useState<'left' | 'right'>('left');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollMenu = (direction: 'up' | 'down') => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    
    // Find all airport buttons
    const items = container.querySelectorAll('.airport-item');
    if (items.length === 0) return;

    const scrollTop = container.scrollTop;
    const headerHeight = 60; // Increased height of our sticky header
    
    // Find is index of item currently at top
    let currentIndex = -1;
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as HTMLElement;
      // An item is considered "active" if its top is near the scroll area start (allowing for header)
      if (item.offsetTop >= scrollTop + headerHeight - 10) { // 10px buffer
        currentIndex = i;
        break;
      }
    }

    if (currentIndex === -1) currentIndex = items.length - 1;

    let nextIndex;
    if (direction === 'up') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else {
      // If we are already pointing at the top item and moving down, we want next index
      nextIndex = Math.min(items.length - 1, currentIndex + 1);
    }

    const targetItem = items[nextIndex] as HTMLElement;
    container.scrollTo({
      top: targetItem.offsetTop - headerHeight,
      behavior: 'smooth'
    });
  };
  const [selectedAirport, setSelectedAirport] = useState(() => {
    return localStorage.getItem('selected_icao') || 'EPKK';
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const WeatherIconComponent = ({ iconName, isDay }: { iconName: string, isDay: boolean }) => {
    const name = iconName.toLowerCase();
    
    // SVG Parts
    const SunSVG = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="4" fill="#FBBF24" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <rect key={deg} x="11.5" y="3" width="1" height="3" rx="0.5" fill="#FBBF24" transform={`rotate(${deg} 12 12)`} />
        ))}
      </svg>
    );

    const MoonSVG = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#FBBF24" />
        <path d="M19 5.5l0.5 0.5l0.5-0.5l-0.5-0.5z" fill="#FBBF24" className="animate-pulse" />
        <path d="M17 3.5l0.5 0.5l0.5-0.5l-0.5-0.5z" fill="#FBBF24" className="animate-pulse" style={{ animationDelay: '1s' }} />
      </svg>
    );

    const CloudSVG = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.4-1.9-4.3-4.2-4.5C17.3 6.9 14.3 4 10.5 4 7.2 4 4.4 6.2 3.6 9.2 1.5 10.1 0 12.1 0 14.5 0 17 2 19 4.5 19h13z" fill="white" />
      </svg>
    );

    const RainLines = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="8" y1="18" x2="6" y2="22" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="18" x2="10" y2="22" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="18" x2="14" y2="22" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );

    const DrizzleDrops = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="20" r="1" fill="#60A5FA" />
        <circle cx="12" cy="21" r="1" fill="#60A5FA" />
        <circle cx="16" cy="20" r="1" fill="#60A5FA" />
      </svg>
    );

    const Snowflakes = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 19l1 1-1 1-1-1 1-1z" fill="#60A5FA" />
        <path d="M12 20l1 1-1 1-1-1 1-1z" fill="#60A5FA" />
        <path d="M16 19l1 1-1 1-1-1 1-1z" fill="#60A5FA" />
        <path d="M10 22l1 1-1 1-1-1 1-1z" fill="#60A5FA" />
        <path d="M14 22l1 1-1 1-1-1 1-1z" fill="#60A5FA" />
      </svg>
    );

    const LightningSVG = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#F59E0B" />
      </svg>
    );

    const FogLines = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="4" y1="18" x2="20" y2="18" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="21" x2="18" y2="21" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );

    const WavyLines = ({ className = "" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 18c1.5 0 1.5 2 3 2s1.5-2 3-2 1.5 2 3 2 1.5-2 3-2 1.5 2 3 2" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M4 21c1.5 0 1.5 2 3 2s1.5-2 3-2 1.5 2 3 2 1.5-2 3-2 1.5 2 3 2" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    );

    const iconBaseClass = "w-12 h-12";
    
    switch (name) {
      case 'sunny':
      case 'clear':
        return isDay 
          ? <SunSVG className={iconBaseClass} /> 
          : <MoonSVG className={iconBaseClass} />;
      
      case 'few':
        return (
          <div className="relative w-12 h-12">
            <div className="absolute inset-x-0 bottom-0 z-10 scale-75 translate-y-1">
              <CloudSVG className="w-12 h-12" />
            </div>
            <div className="absolute top-0 left-0">
               {isDay ? <SunSVG className="w-8 h-8" /> : <MoonSVG className="w-8 h-8" />}
            </div>
          </div>
        );

      case 'scattered':
        return (
          <div className="relative w-12 h-12">
             <div className="absolute top-0 right-0 z-10 scale-50">
               <CloudSVG className="w-12 h-12" />
             </div>
             <div className="absolute inset-0 flex items-center justify-center translate-y-1">
               {isDay ? <SunSVG className="w-10 h-10" /> : <MoonSVG className="w-10 h-10" />}
             </div>
          </div>
        );

      case 'broken':
        return (
          <div className="relative w-12 h-12">
            <div className="absolute top-0 left-0">
              {isDay ? <SunSVG className="w-8 h-8" /> : <MoonSVG className="w-8 h-8" />}
            </div>
            <div className="absolute inset-0 flex items-center justify-center z-10 -translate-x-1 translate-y-1">
              <CloudSVG className="w-12 h-12" />
            </div>
          </div>
        );
        
      case 'overcast':
        return (
          <div className="relative w-12 h-12">
            <CloudSVG className="w-10 h-10 absolute left-0 top-0 opacity-60" />
            <CloudSVG className="w-10 h-10 absolute right-0 bottom-0" />
          </div>
        );
        
      case 'drizzle':
        return (
          <div className="relative w-12 h-12">
            <CloudSVG className="w-10 h-10 mx-auto" />
            <DrizzleDrops className="absolute inset-0 w-12 h-12" />
          </div>
        );
        
      case 'rain':
        return (
          <div className="relative w-12 h-12">
            <CloudSVG className="w-10 h-10 mx-auto" />
            <RainLines className="absolute inset-0 w-12 h-12" />
          </div>
        );
        
      case 'snow':
        return (
          <div className="relative w-12 h-12">
            <CloudSVG className="w-10 h-10 mx-auto" />
            <Snowflakes className="absolute inset-0 w-12 h-12" />
          </div>
        );
        
      case 'hail':
        return (
          <div className="relative w-12 h-12">
            <CloudSVG className="w-10 h-10 mx-auto" />
            <div className="absolute inset-0 flex items-end justify-center pb-1 gap-0.5">
               <div className="w-1.5 h-1.5 bg-blue-300" />
               <div className="w-1.5 h-1.5 bg-blue-300 translate-y-1" />
               <div className="w-1.5 h-1.5 bg-blue-300" />
            </div>
          </div>
        );
        
      case 'thunder':
        return (
          <div className="relative w-12 h-12">
            <CloudSVG className="w-10 h-10 mx-auto" />
            <LightningSVG className="absolute bottom-0 right-1 w-6 h-6" />
          </div>
        );
        
      case 'fog':
        return (
          <div className="relative w-12 h-12">
            <CloudSVG className="w-10 h-10 mx-auto" />
            <FogLines className="absolute inset-0 w-12 h-12" />
          </div>
        );
        
      case 'mist':
        return (
          <div className="relative w-12 h-12">
            <CloudSVG className="w-10 h-10 mx-auto" />
            <WavyLines className="absolute inset-0 w-12 h-12" />
          </div>
        );
        
      case 'haze':
        return (
          <div className="relative w-12 h-12 flex flex-col items-center justify-center">
            <div className="scale-75 -translate-y-1">
              {isDay ? <SunSVG className="w-10 h-10" /> : <MoonSVG className="w-10 h-10" />}
            </div>
            <FogLines className="absolute bottom-0 w-12 h-12" />
          </div>
        );
        
      default:
        return isDay ? <SunSVG className={iconBaseClass} /> : <MoonSVG className={iconBaseClass} />;
    }
  };

  const fetchWeather = useCallback(async () => {
    if (!selectedAirport) return;
    setLoading(true);
    setIsRefreshing(true);
    try {
      let result: WeatherData;
      if ((window as any).__TAURI__) {
        result = await invoke<WeatherData>('get_weather', { icaoCode: selectedAirport });
      } else {
        // Mock data for Browser Preview - Immediate
        result = {
          temperature: (Math.floor(Math.random() * 20)).toString(),
          wind: (Math.floor(Math.random() * 30)).toString(),
          humidity: (Math.floor(Math.random() * 40) + 40).toString(),
          pressure: "1013",
          wind_dir: 110,
          phenomena: null,
          icon: "sunny", // Using a valid icon for testing
          is_day: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
      
      setData(result);
      localStorage.setItem('weatherData', JSON.stringify(result));
      localStorage.setItem('selected_icao', selectedAirport);
      setError(null);
      setIsStale(false);
    } catch (err: any) {
      setData(null);
      const errorMessage = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      setError(errorMessage || 'Błąd połączenia z serwerem');
      setIsStale(false);
    } finally {
      setLoading(false);
      // Small delay to ensure smooth transition
      setTimeout(() => setIsRefreshing(false), 200);
    }
  }, [selectedAirport]); // Correctly depends on selectedAirport

  useEffect(() => {
    // Initial fetch on mount
    fetchWeather();
    
    // Aligns to next 00 or 30 minute mark
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const msToNextAligned = ((30 - (minutes % 30)) * 60 - seconds) * 1000;
    
    let interval: any;
    const timeout = setTimeout(() => {
      fetchWeather();
      interval = setInterval(fetchWeather, 30 * 60 * 1000);
    }, msToNextAligned);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [selectedAirport, fetchWeather]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeApp = async () => {
    if ((window as any).__TAURI__) {
      await invoke('close_window');
    }
  };

  const startDragging = (e: React.MouseEvent) => {
    if ((window as any).__TAURI__ && !showContextMenu) {
      const target = e.target as HTMLElement;
      if (!target.closest('button')) {
        appWindow.startDragging();
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center font-sans w-full h-full select-none bg-transparent pointer-events-none"
      onContextMenu={handleContextMenu}
    >
      <AnimatePresence mode="wait">
        {!isCollapsed ? (
          <motion.div 
            key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onMouseDown={startDragging}
            className="relative bg-[#151619] text-white rounded-[12px] shadow-2xl ring-1 ring-white/10 flex items-center cursor-move z-10 p-[2px] gap-[2px] h-[68px] pointer-events-auto"
          >
            {/* Top Gradient Line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 opacity-50 rounded-t-[12px]" />
            
            {/* Airport Sign (Bottom Left) & Location Picker */}
            <div className="absolute bottom-[3px] left-[6px] flex items-center gap-1 z-[60]">
              <div className="text-[12px] font-sans font-bold text-white pointer-events-none uppercase tracking-wider">
                {selectedAirport}
              </div>
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                  className={`p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer ${isMenuOpen ? 'text-white' : 'text-emerald-500'}`}
                  title="Wybierz lokalizację"
                >
                  <MapPin className="w-3.5 h-3.5" />
                </button>
                {/* Airport Selection Menu */}
                <AnimatePresence>
                  {isMenuOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
                      {/* Dark Overlay with pointer events */}
                      <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                      
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-[500px] h-fit max-h-[85vh] bg-[#1A1C1E] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col pointer-events-auto cursor-default font-sans"
                        onMouseDown={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {/* Header Box with Navigation and Close Button */}
                        <div className="p-4 border-b border-white/5 bg-[#151619] flex items-center justify-between shrink-0">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">Wybierz lotnisko</span>
                            <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1 italic">Lista lotnisk i lądowisk PL</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Scroll Arrows */}
                            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                              <button 
                                onClick={(e) => { e.stopPropagation(); scrollMenu('up'); }}
                                className="p-1.5 hover:bg-white/10 text-emerald-500 rounded-md transition-colors active:scale-95"
                                title="Przewiń w górę"
                              >
                                <ChevronDown className="w-[18px] h-[18px] rotate-180" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); scrollMenu('down'); }}
                                className="p-1.5 hover:bg-white/10 text-emerald-500 rounded-md transition-colors border-l border-white/10 active:scale-95"
                                title="Przewiń w dół"
                              >
                                <ChevronDown className="w-[18px] h-[18px]" />
                              </button>
                            </div>
                            
                            {/* Big Close X Button */}
                            <button 
                              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}
                              className="p-[7px] bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all shadow-lg active:scale-90 flex items-center justify-center group"
                              title="Zamknij listę (X)"
                            >
                              <X className="w-[18px] h-[18px] stroke-[3px]" />
                            </button>
                          </div>
                        </div>
                        <div 
                          ref={scrollRef}
                          className="flex-1 overflow-y-auto p-2 scroll-smooth airport-scrollbar no-scrollbar"
                          onScroll={(e) => e.stopPropagation()}
                        >
                          {AIRPORTS.flatMap(group => group.airports).map((airport) => (
                            <button
                              key={airport.code}
                              onClick={() => {
                                setSelectedAirport(airport.code);
                                setIsMenuOpen(false);
                              }}
                              className={`airport-item w-full text-left px-5 py-[2px] rounded-xl transition-all flex items-center justify-between group ${
                                selectedAirport === airport.code 
                                  ? 'bg-emerald-500/10 text-emerald-400 font-bold underline decoration-2' 
                                  : 'hover:bg-white/5 text-zinc-400 hover:text-white'
                              }`}
                            >
                              <span className="text-[22px] font-medium truncate pr-4">{airport.name}</span>
                              <span className="text-[18px] font-mono opacity-50 group-hover:opacity-100 shrink-0">{airport.code}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="flex items-center gap-[2px] pr-1">
              {/* Left Collapse Arrow */}
              <button 
                onClick={(e) => { e.stopPropagation(); setCollapseSide('left'); setIsCollapsed(true); }}
                className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors cursor-pointer group/btn"
                title="Zwiń"
              >
                <ChevronLeft className="w-5 h-5 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
              </button>

              {/* Weather Content */}
            <div className="flex flex-col items-center min-h-[64px]">
              <AnimatePresence mode="wait">
                {error ? (
                  <div className="flex flex-col items-center justify-center h-[64px] min-w-[340px] px-8">
                    <div className="flex items-center gap-2 text-white text-[16px] font-bold uppercase tracking-widest mb-1.5">
                      <AlertCircle className="w-5 h-5" />
                      <span>BłAD POBIERANIA DANYCH</span>
                    </div>
                    <p className="text-[14px] text-white font-mono text-center max-w-[360px] leading-snug font-bold">
                      {error}
                    </p>
                  </div>
                ) : data ? (
                  <div className="flex flex-col items-center px-1 pb-1">
                      <motion.div 
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col gap-1 translate-y-[4px]"
                      >
                      {/* Labels Row */}
                      <div className="flex items-center mb-0 px-1">
                        <div className="flex items-center gap-1.5 w-[130px]">
                          <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                          <span className="text-[12px] font-sans font-bold tracking-wider text-[#D1D5DB] uppercase">TEMPERATURA</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 w-[84px]">
                          <Wind className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-[12px] font-sans font-bold tracking-wider text-[#D1D5DB] uppercase">WIATR</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 w-[84px]">
                          <Droplets className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[12px] font-sans font-bold tracking-wider text-[#D1D5DB] uppercase">WILG.</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 w-[94px] border-l border-white/10 ml-1 pl-1">
                          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-[12px] font-sans font-bold tracking-wider text-[#D1D5DB] uppercase">CIŚNIENIE</span>
                        </div>
                      </div>

                      {/* Values Row */}
                      <div className="flex items-center px-1">
                        {/* Temperature */}
                        <div className="flex items-center justify-center gap-3 w-[130px]">
                          {data.icon ? (
                            <div className="relative w-12 h-12 flex items-center justify-center translate-x-[3px] -translate-y-[2px]">
                              <WeatherIconComponent iconName={data.icon} isDay={data.is_day} />
                            </div>
                          ) : (
                            <div className="w-12 h-12 flex items-center justify-center">
                              <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin opacity-20" />
                            </div>
                          )}
                          <div className="text-3xl font-mono font-medium tracking-tighter">
                            {data.temperature ?? '--'}<span className="text-xl text-white ml-0.5">°C</span>
                          </div>
                        </div>

                        {/* Wind */}
                        <div className="flex items-center justify-center gap-2 w-[84px]">
                          <div className="text-3xl font-mono font-medium tracking-tighter">
                            {data.wind ?? '--'}<span className="text-base text-white ml-0.5">km/h</span>
                          </div>
                        </div>

                        {/* Humidity */}
                        <div className="flex items-center justify-center w-[84px]">
                          <div className="text-3xl font-mono font-medium tracking-tighter">
                            {data.humidity ?? '--'}<span className="text-xl text-white">%</span>
                          </div>
                        </div>

                        {/* Pressure */}
                        <div className="flex items-center justify-center w-[94px] border-l border-white/10 ml-1 pl-1">
                          <div className="text-3xl font-mono font-medium tracking-tighter">
                            {data.pressure ?? '--'}<span className="text-xl text-white ml-0.5">hPa</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    
                    {isStale && (
                      <div className="text-[12px] font-sans font-bold text-white uppercase tracking-widest pb-1">
                        Ostatnie dobre dane
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[60px] flex items-center px-10 text-white text-[16px] font-bold tracking-[0.2em] uppercase">Pobieranie danych...</div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Controls Column */}
            <div className="flex flex-col items-center justify-center h-[64px] min-w-[32px] pr-1.5 relative">
              {/* App Close Button (Red X) - Aligned to Labels */}
              <button 
                onClick={(e) => { e.stopPropagation(); closeApp(); }}
                className="absolute top-[1px] w-5 h-5 flex items-center justify-center hover:bg-white/10 rounded-full transition-all cursor-pointer group/close shrink-0"
                title="Zamknij Pogoda-AirportPL"
              >
                <X className="w-3.5 h-3.5 text-red-500/70 group-hover/close:text-red-500 group-hover/close:scale-125" strokeWidth={3} />
              </button>

              {/* Right Collapse Arrow - Vertically Centered */}
              <button 
                onClick={(e) => { e.stopPropagation(); setCollapseSide('right'); setIsCollapsed(true); }}
                className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors cursor-pointer group/btn shrink-0"
                title="Zwiń"
              >
                <ChevronRight className="w-5 h-5 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </motion.div>
        ) : (
          <motion.button 
            key="collapsed"
            initial={{ opacity: 0, x: collapseSide === 'left' ? -216 : 216, y: 0 }}
            animate={{ opacity: 1, x: collapseSide === 'left' ? -216 : 216, y: 0 }}
            exit={{ opacity: 0, x: collapseSide === 'left' ? -216 : 216, y: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsCollapsed(false)}
            onMouseDown={startDragging}
            className="relative bg-[#151619] text-emerald-400 shadow-2xl ring-1 ring-white/10 hover:bg-[#1C1E22] transition-colors cursor-pointer group flex items-center justify-center w-8 h-8 rounded-md z-50 pointer-events-auto"
            title="Rozwiń"
          >
            {collapseSide === 'left' ? (
              <ChevronRight className="w-5 h-5 group-hover:scale-110 transition-transform drop-shadow-md" />
            ) : (
              <ChevronLeft className="w-5 h-5 group-hover:scale-110 transition-transform drop-shadow-md" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Custom Context Menu Overlay */}
      <AnimatePresence>
        {showContextMenu && (
          <>
            {/* Backdrop to close menu */}
            <div 
              className="fixed inset-0 z-[9998]" 
              onMouseDown={() => setShowContextMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ 
                position: 'fixed',
                top: showContextMenu.y,
                left: showContextMenu.x,
                zIndex: 9999 
              }}
              className="bg-[#1C1E22] border border-white/10 rounded-lg shadow-xl py-1 min-w-[150px] pointer-events-auto"
            >
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  fetchWeather();
                  setShowContextMenu(null);
                }}
                className="w-full px-4 py-3 text-left text-[11px] font-sans font-medium text-emerald-400 hover:bg-emerald-400/10 flex items-center gap-2 transition-colors cursor-pointer"
              >
                Odśwież dane
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

