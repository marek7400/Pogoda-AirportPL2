import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Download, AlertCircle, Activity, CalendarDays, List, LineChart as LineChartIcon } from 'lucide-react';
import { appWindow } from '@tauri-apps/api/window';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
  info: string;
}

class ChartErrorBoundary extends React.Component<{children: React.ReactNode}, ErrorBoundaryState> {
  // @ts-ignore
  state: ErrorBoundaryState = { hasError: false, error: '', info: '' };
  
  constructor(props: {children: React.ReactNode}) {
    super(props);
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error.toString(), info: '' };
  }
  componentDidCatch(error: any, errorInfo: any) {
    // @ts-ignore
    this.setState({ info: errorInfo.componentStack });
    console.error("Chart Crash:", error, errorInfo);
  }
  render() {
    // @ts-ignore
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/50 p-6 overflow-auto">
          <AlertCircle className="w-16 h-16 text-white mb-4" />
          <h2 className="text-white text-2xl font-bold mb-4">BŁĄD RENDEROWANIA</h2>
          {/* @ts-ignore */}
          <p className="text-white font-mono text-sm bg-black/50 p-4 rounded w-full">{this.state.error}</p>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

interface HistoryModalProps {
  icaoCode: string;
  onClose: () => void;
}

interface MetarRecord {
  valid: string;
  timestamp: number;
  tmpc: number | null;
  dwpc: number | null;
  windKmh: number | null;
  pressureHpa: number | null;
  metar: string;
}

export default function HistoryModal({ icaoCode, onClose }: HistoryModalProps) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateError, setDateError] = useState<string | null>(null);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val && endDate && val > endDate) {
      setDateError("DATA OD NIE MOŻE BYĆ PÓŹNIEJSZA NIŻ DO. Wybierz ponownie.");
    } else {
      setDateError(null);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (val && startDate && val < startDate) {
      setDateError("DATA DO NIE MOŻE BYĆ WCZEŚNIEJSZA NIŻ OD. Wybierz ponownie.");
    } else {
      setDateError(null);
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MetarRecord[]>([]);

  const [showTemp, setShowTemp] = useState(true);
  const [showDew, setShowDew] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [showPressure, setShowPressure] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  const [lineWidth, setLineWidth] = useState(3);
  const [tempColor, setTempColor] = useState('#ff4d4d');
  const [dewColor, setDewColor] = useState('#f97316');
  const [windColor, setWindColor] = useState('#60a5fa');
  const [pressureColor, setPressureColor] = useState('#c084fc');

  const [showDataModal, setShowDataModal] = useState(false);
  
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const dragRef = useRef<{ isDragging: boolean, startX: number, startDomain: [number, number] } | null>(null);

  useEffect(() => {
    let isMaximized = false;
    const initWindow = async () => {
      if ((window as any).__TAURI__) {
        try {
          isMaximized = await appWindow.isMaximized();
          if (!isMaximized) await appWindow.maximize();
        } catch (e) { console.error(e); }
      }
    };
    initWindow();
    return () => {
      if ((window as any).__TAURI__ && !isMaximized) {
        appWindow.unmaximize().catch(console.error);
      }
    };
  }, []);

  const fetchData = async () => {
    if (!startDate || !endDate || dateError) return;
    setLoading(true);
    setError(null);
    try {
      const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
      const start = new Date(sYear, sMonth - 1, sDay);
      const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
      const end = new Date(eYear, eMonth - 1, eDay);
      end.setDate(end.getDate() + 1);

      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const url = `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${icaoCode}&data=all&year1=${start.getFullYear()}&month1=${start.getMonth() + 1}&day1=${start.getDate()}&year2=${end.getFullYear()}&month2=${end.getMonth() + 1}&day2=${end.getDate()}&tz=${userTz}&format=comma`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Błąd pobierania danych.');

      const csvText = await response.text();
      const lines = csvText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      if (lines.length < 2) throw new Error('Brak danych dla wybranego zakresu.');

      const headers = lines[0].split(',').map(h => h.trim());
      const idx = {
        valid: headers.indexOf('valid'),
        tmpf: headers.indexOf('tmpf'),
        dwpf: headers.indexOf('dwpf'),
        sknt: headers.indexOf('sknt'),
        alti: headers.indexOf('alti'),
        metar: headers.indexOf('metar')
      };

      const records: MetarRecord[] = [];
      const seen = new Set();

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const validStr = parts[idx.valid];
        const ts = new Date(validStr.replace(' ', 'T')).getTime();
        if (isNaN(ts) || seen.has(ts)) continue;
        seen.add(ts);

        const parseNum = (val: string) => {
          if (!val || val === 'M') return null;
          const n = parseFloat(val);
          return isNaN(n) ? null : n;
        };

        const fToC = (f: number | null) => f !== null ? Number(((f - 32) * 5 / 9).toFixed(1)) : null;

        records.push({
          valid: validStr,
          timestamp: ts,
          tmpc: fToC(parseNum(parts[idx.tmpf])),
          dwpc: fToC(parseNum(parts[idx.dwpf])),
          windKmh: parseNum(parts[idx.sknt]) !== null ? Number((parseNum(parts[idx.sknt])! * 1.852).toFixed(1)) : null,
          pressureHpa: parseNum(parts[idx.alti]) !== null ? Number((parseNum(parts[idx.alti])! * 33.8639).toFixed(1)) : null,
          metar: parts[idx.metar] || ''
        });
      }

      records.sort((a, b) => a.timestamp - b.timestamp);
      setData(records);
      
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const startBounds = new Date(sy, sm - 1, sd).getTime();
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endBounds = new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime();
      setZoomDomain([startBounds, endBounds]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const xAxisTicks = React.useMemo(() => {
    if (!zoomDomain || data.length === 0) return [];
    const [start, end] = zoomDomain;
    const rangeMs = end - start;
    const rangeHours = rangeMs / (1000 * 60 * 60);

    const possibleSteps = [
      30, 60, 120, 180, 240, 360, 480, 720, 1440, // Up to 1 day
      1440 * 2, 1440 * 3, 1440 * 4, 1440 * 5, 1440 * 7, // Multi-day
      1440 * 14, 1440 * 30, 1440 * 60, 1440 * 90, 1440 * 180, 1440 * 365 // Months and Year
    ];
    let stepMinutes = 30;
    const maxTargetTicks = 9; // More conservative limit to prevent overlaps with dates

    for (const step of possibleSteps) {
      stepMinutes = step;
      if (rangeMs / (step * 60 * 1000) <= maxTargetTicks) break;
    }

    const ticks: number[] = [];
    const stepMs = stepMinutes * 60 * 1000;
    
    // Aligned midnight start
    const midnight = new Date(start);
    midnight.setHours(0, 0, 0, 0);
    let current = midnight.getTime();
    
    // Move to first visible
    while (current < start) {
      current += stepMs;
    }
    
    while (current <= end) {
      ticks.push(current);
      current += stepMs;
    }
    
    return ticks;
  }, [zoomDomain, data]);

  const calculateYAxis = (type: 'temp' | 'wind' | 'pressure') => {
    let relevantData = data;
    if (zoomDomain) {
      relevantData = data.filter(d => d.timestamp >= zoomDomain[0] && d.timestamp <= zoomDomain[1]);
    }

    const vals: number[] = [];
    if (type === 'temp') {
      relevantData.forEach(d => {
        if (showTemp && d.tmpc !== null && isFinite(d.tmpc)) vals.push(d.tmpc);
        if (showDew && d.dwpc !== null && isFinite(d.dwpc)) vals.push(d.dwpc);
      });
    } else if (type === 'wind') {
      relevantData.forEach(d => {
        if (showWind && d.windKmh !== null && isFinite(d.windKmh)) vals.push(d.windKmh);
      });
    } else if (type === 'pressure') {
      relevantData.forEach(d => {
        if (showPressure && d.pressureHpa !== null && isFinite(d.pressureHpa)) vals.push(d.pressureHpa);
      });
    }

    if (vals.length === 0 && data.length > 0) {
      if (type === 'temp') {
        data.forEach(d => {
          if (showTemp && d.tmpc !== null && isFinite(d.tmpc)) vals.push(d.tmpc);
          if (showDew && d.dwpc !== null && isFinite(d.dwpc)) vals.push(d.dwpc);
        });
      } else if (type === 'wind') {
        data.forEach(d => {
          if (showWind && d.windKmh !== null && isFinite(d.windKmh)) vals.push(d.windKmh);
        });
      } else if (type === 'pressure') {
        data.forEach(d => {
          if (showPressure && d.pressureHpa !== null && isFinite(d.pressureHpa)) vals.push(d.pressureHpa);
        });
      }
    }

    if (vals.length === 0) {
      if (type === 'temp') return { domain: [0, 40], ticks: [0, 10, 20, 30, 40] };
      if (type === 'wind') return { domain: [0, 50], ticks: [0, 10, 20, 30, 40, 50] };
      return { domain: [1000, 1030], ticks: [1000, 1010, 1020, 1030] };
    }

    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const range = rawMax - rawMin;

    let step = 5;
    if (type === 'temp') {
      if (range <= 10) step = 1;
      else if (range <= 20) step = 2;
      else step = 5;
    } else if (type === 'wind') {
      step = 10;
      if (range <= 20) step = 5;
    } else {
      step = 5;
    }

    const domainMin = Math.floor(rawMin / step) * step;
    const domainMax = Math.ceil(rawMax / step) * step;
    
    const ticks = [];
    for (let i = domainMin; i <= domainMax; i += step) {
      ticks.push(i);
    }
    
    // Safety check for wind: start at 0 if no negatives
    if (type === 'wind' && domainMin >= 0) {
      const finalTicks = ticks[0] !== 0 ? [0, ...ticks] : ticks;
      return { domain: [0, domainMax], ticks: finalTicks };
    }

    return { domain: [domainMin, domainMax], ticks };
  };

  const tempAxis = calculateYAxis('temp');
  const windAxis = calculateYAxis('wind');
  const pressureAxis = calculateYAxis('pressure');

  const hasNegativeTemp = (showTemp || showDew) && data.some(d => d.tmpc !== null && d.tmpc < 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!showTooltip) return null;
    if (active && payload && payload.length) {
      const d = payload[0].payload as MetarRecord;
      const dStr = new Date(d.timestamp).toLocaleString('pl-PL', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      return (
        <div className="bg-black/90 border border-white/20 p-6 rounded-xl text-2xl font-mono min-w-[320px] shadow-2xl">
          <p className="text-emerald-400 font-bold mb-3 text-3xl">{dStr}</p>
          <p className="mb-1">Temp: <span className="font-bold">{d.tmpc}°C</span></p>
          <p className="mb-1">Punkt Rosy: <span className="font-bold">{d.dwpc}°C</span></p>
          <p className="mb-1">Wiatr: <span className="font-bold">{d.windKmh} km/h</span></p>
          <p className="mb-1">Ciśn: <span className="font-bold">{d.pressureHpa} hPa</span></p>
          <p className="mt-4 opacity-70 break-words text-lg leading-tight border-t border-white/20 pt-3">{d.metar}</p>
        </div>
      );
    }
    return null;
  };

  // Zoom and Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (!zoomDomain || data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = rect.width;
    
    // Calculate the percentage of X where the mouse is
    const relativeX = Math.max(0, Math.min(1, mouseX / width));
    
    const [dStart, dEnd] = zoomDomain;
    const range = dEnd - dStart;
    const mouseTimestamp = dStart + relativeX * range;
    
    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
    let newRange = range * zoomFactor;

    const minRange = 1000 * 60 * 60 * 2;
    const maxRange = data[data.length - 1].timestamp - data[0].timestamp;
    if (newRange < minRange) newRange = minRange;
    if (newRange > maxRange) newRange = maxRange;

    // Center zoom around the mouseTimestamp
    let newStart = mouseTimestamp - relativeX * newRange;
    let newEnd = newStart + newRange;

    const minT = data[0].timestamp;
    const maxT = data[data.length - 1].timestamp;

    if (newStart < minT) {
      newEnd += (minT - newStart);
      newStart = minT;
    }
    if (newEnd > maxT) {
      newStart -= (newEnd - maxT);
      newEnd = maxT;
    }
    
    // Final clamp
    newStart = Math.max(minT, newStart);
    newEnd = Math.min(maxT, newEnd);
    
    setZoomDomain([newStart, newEnd]);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    if (zoomDomain) {
      dragRef.current = { isDragging: true, startX: e.clientX, startDomain: zoomDomain };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current?.isDragging || !zoomDomain || data.length === 0) return;
    const dx = e.clientX - dragRef.current.startX;
    const containerWidth = window.innerWidth - 60; // Approximate chart width
    if (containerWidth <= 0) return;
    const range = dragRef.current.startDomain[1] - dragRef.current.startDomain[0];
    
    const shift = (dx / containerWidth) * range;
    let newStart = dragRef.current.startDomain[0] - shift;
    let newEnd = dragRef.current.startDomain[1] - shift;

    const minT = data[0].timestamp;
    const maxT = data[data.length - 1].timestamp;

    if (newStart < minT) {
      newStart = minT;
      newEnd = newStart + range;
    }
    if (newEnd > maxT) {
      newEnd = maxT;
      newStart = newEnd - range;
    }

    setZoomDomain([Math.max(minT, newStart), Math.min(maxT, newEnd)]);
  };

  const clearDrag = () => {
    if (dragRef.current) dragRef.current.isDragging = false;
  };

  // Min/Max computation logic
  const getMinMaxStr = () => {
    if (data.length === 0) return null;
    const visibleData = zoomDomain ? data.filter(d => d.timestamp >= zoomDomain[0] && d.timestamp <= zoomDomain[1]) : data;
    if (visibleData.length === 0) return null;

    const activeCount = [showTemp, showDew, showWind, showPressure].filter(Boolean).length;
    const isSingle = activeCount === 1;

    const blocks: React.ReactNode[] = [];

    const formatTime = (ts: number) => {
      const d = new Date(ts);
      return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const addBlock = (key: string, dataKey: keyof MetarRecord, name: string, color: string) => {
      const validData = visibleData.filter(d => d[dataKey] !== null);
      if (validData.length === 0) return;
      
      const vals = validData.map(d => d[dataKey] as number);
      const min = Math.min(...vals);
      const max = Math.max(...vals);

      if (isSingle) {
        const minItems = validData.filter(d => d[dataKey] === min);
        const maxItems = validData.filter(d => d[dataKey] === max);
        const minTimeStr = minItems.length > 0 ? formatTime(minItems[0].timestamp) : '';
        const maxTimeStr = maxItems.length > 0 ? formatTime(maxItems[0].timestamp) : '';

        blocks.push(
          <div key={key} style={{color}} className="flex gap-6 items-center flex-wrap">
            <span className="flex items-baseline gap-2">
              <span className="opacity-70 text-xs">MIN:</span>
              <span className="text-xl">{min}</span>
              <span className="text-[14px] text-white font-normal ml-1">({minTimeStr})</span>
            </span>
            <span className="w-[1px] h-4 bg-white/20"></span>
            <span className="flex items-baseline gap-2">
              <span className="opacity-70 text-xs">MAX:</span>
              <span className="text-xl">{max}</span>
              <span className="text-[14px] text-white font-normal ml-1">({maxTimeStr})</span>
            </span>
          </div>
        );
      } else {
        blocks.push(<span key={key} style={{color}}>{name}: {min}/{max}</span>);
      }
    };

    if (showTemp) addBlock('t', 'tmpc', 'T', tempColor);
    if (showDew) addBlock('d', 'dwpc', 'R', dewColor);
    if (showWind) addBlock('w', 'windKmh', 'W', windColor);
    if (showPressure) addBlock('p', 'pressureHpa', 'C', pressureColor);
    
    if (blocks.length === 0) return null;
    return (
      <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 border-[0.5px] border-white/20 rounded-xl flex gap-6 text-[14px] font-bold shadow-xl z-[50] pointer-events-none items-center">
        {!isSingle && <span className="text-zinc-500 uppercase">Min/Max:</span>}
        {blocks}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-[#151619] flex flex-col text-white select-none overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between bg-[#1A1C1E] p-3 border-b border-white/5" onMouseDown={(e) => {
        // Only start window drag if clicked on the header specifically, not buttons inside
        if ((e.target as HTMLElement).closest('button')) return;
        if ((window as any).__TAURI__) appWindow.startDragging();
      }}>
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-bold uppercase tracking-widest">Dane Historyczne - {icaoCode}</h2>
        </div>
        <button 
          onMouseDown={(e) => { e.stopPropagation(); onClose(); }} 
          className="p-1.5 hover:bg-red-500 rounded transition-colors text-red-500 hover:text-white pointer-events-auto"
        >
          <X className="w-6 h-6 stroke-[3px]" />
        </button>
      </div>

      <div className="bg-[#1A1C1E] p-4 flex flex-wrap gap-4 items-center border-b border-white/5 shadow-xl z-20 shrink-0">
        <label className="flex items-center gap-2 group cursor-pointer">
          <span className="text-zinc-400 font-bold text-sm">OD:</span>
          <div className="relative" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker()}>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => handleStartDateChange(e.target.value)} 
              onClick={(e) => e.stopPropagation()} 
              className="bg-black/40 border border-white/10 rounded pl-3 pr-8 py-1 text-sm font-mono cursor-pointer hover:border-emerald-500 transition-colors focus:outline-none w-[145px] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer z-10 relative" 
            />
            <CalendarDays className="w-4 h-4 text-emerald-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-emerald-400 z-0" />
          </div>
        </label>
        <span className="text-zinc-500 font-bold">-</span>
        <label className="flex items-center gap-2 group cursor-pointer">
          <span className="text-zinc-400 font-bold text-sm">DO:</span>
          <div className="relative" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker()}>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => handleEndDateChange(e.target.value)} 
              onClick={(e) => e.stopPropagation()} 
              className="bg-black/40 border border-white/10 rounded pl-3 pr-8 py-1 text-sm font-mono cursor-pointer hover:border-emerald-500 transition-colors focus:outline-none w-[145px] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer z-10 relative" 
            />
            <CalendarDays className="w-4 h-4 text-emerald-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-emerald-400 z-0" />
          </div>
        </label>
        {dateError && (
          <div className="flex items-center gap-2 text-red-500 font-bold text-[10px] animate-pulse bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
            <AlertCircle className="w-3 h-3" />
            {dateError}
          </div>
        )}
        <button onClick={fetchData} disabled={loading || !!dateError} className="px-6 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded font-bold flex items-center gap-2 text-sm uppercase transition-colors shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Pobierz
        </button>
        <div className="w-[1px] h-8 bg-white/10 mx-2"></div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm uppercase font-bold cursor-pointer hover:text-emerald-400 transition-colors">
            <input type="checkbox" checked={showTemp} onChange={e => setShowTemp(e.target.checked)} className="w-4 h-4 accent-emerald-500" /> Temp
          </label>
          <label className="flex items-center gap-2 text-sm uppercase font-bold cursor-pointer hover:text-emerald-400 transition-colors">
            <input type="checkbox" checked={showDew} onChange={e => setShowDew(e.target.checked)} className="w-4 h-4 accent-emerald-500" /> Punkt Rosy
          </label>
          <label className="flex items-center gap-2 text-sm uppercase font-bold cursor-pointer hover:text-emerald-400 transition-colors">
            <input type="checkbox" checked={showWind} onChange={e => setShowWind(e.target.checked)} className="w-4 h-4 accent-emerald-500" /> Wiatr
          </label>
          <label className="flex items-center gap-2 text-sm uppercase font-bold cursor-pointer hover:text-emerald-400 transition-colors">
            <input type="checkbox" checked={showPressure} onChange={e => setShowPressure(e.target.checked)} className="w-4 h-4 accent-emerald-500" /> Ciśnienie
          </label>
          <div className="w-[1px] h-4 bg-white/10 mx-1 self-center"></div>
          <label className="flex items-center gap-2 text-xs uppercase font-bold cursor-pointer hover:text-blue-400 transition-colors text-zinc-400">
            <input type="checkbox" checked={showTooltip} onChange={e => setShowTooltip(e.target.checked)} className="w-4 h-4 accent-blue-500" /> Info Punktów
          </label>
        </div>
        <div className="ml-auto flex items-center gap-6">
          {data.length > 0 && (
            <span className="text-[14px] font-bold text-zinc-400">{data.length} pomiarów</span>
          )}
          <button 
            onClick={() => setShowDataModal(!showDataModal)}
            className={`px-5 py-2 rounded font-bold flex items-center gap-2 text-[14px] uppercase transition-colors shadow-lg cursor-pointer ${showDataModal ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-black/50 border border-white/20 text-white hover:bg-white/10'}`}
          >
            {showDataModal ? <LineChartIcon className="w-4 h-4" /> : <List className="w-4 h-4" />}
            DANE
          </button>
        </div>
      </div>

      <div 
        className="flex-1 min-h-0 p-4 relative flex flex-col"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={clearDrag}
        onMouseLeave={clearDrag}
        style={{ cursor: dragRef.current?.isDragging ? 'grabbing' : 'grab' }}
      >
        {error && <div className="p-4 bg-red-900/20 text-red-400 rounded border border-red-500/30 mb-4">{error}</div>}
        
        {data.length > 0 ? (
          showDataModal ? (
            <div className="flex-1 w-full overflow-auto bg-black border border-white/10 p-4 font-mono text-white text-[14px] rounded-xl cursor-default" onMouseDown={e => e.stopPropagation()}>
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-black shadow-lg">
                  <tr>
                    <th className="py-2 text-emerald-400">Czas</th>
                    <th className="py-2 text-red-400">Temp [°C]</th>
                    <th className="py-2 text-orange-400">Punkt Rosy [°C]</th>
                    <th className="py-2 text-blue-400">Wiatr [km/h]</th>
                    <th className="py-2 text-purple-400">Ciśnienie [hPa]</th>
                    <th className="py-2 text-zinc-500">METAR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(d => (
                    <tr key={d.timestamp} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2">{new Date(d.timestamp).toLocaleString('pl-PL', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
                      <td className="py-2">{d.tmpc ?? '-'}</td>
                      <td className="py-2">{d.dwpc ?? '-'}</td>
                      <td className="py-2">{d.windKmh ?? '-'}</td>
                      <td className="py-2">{d.pressureHpa ?? '-'}</td>
                      <td className="py-2 opacity-60 max-w-[300px] truncate">{d.metar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 w-full min-h-0 relative">
              {getMinMaxStr()}
              <ChartErrorBoundary>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 60, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="timestamp" 
                      type="number" 
                      domain={zoomDomain || ['dataMin', 'dataMax']} 
                      allowDataOverflow={true}
                      ticks={xAxisTicks}
                      height={60}
                      interval={0}
                      tick={(props: any) => {
                        const { x, y, payload, index } = props;
                        const t = payload.value;
                        const d = new Date(t);
                        const range = zoomDomain ? zoomDomain[1] - zoomDomain[0] : (data.length > 0 ? data[data.length - 1].timestamp - data[0].timestamp : 0);
                        const days = range / (1000 * 60 * 60 * 24);

                        let labelTop = "";
                        let labelBottom = "";

                        const isFirst = index === 0;
                        const isLast = index === xAxisTicks.length - 1;
                        const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;

                        if (days > 2) {
                          const datePart = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                          labelTop = days > 365 ? `${datePart}.${d.getFullYear().toString().slice(-2)}` : datePart;
                        } else {
                          const h = d.getHours();
                          const m = d.getMinutes();
                          labelTop = m === 0 ? h.toString() : `${h}:${m.toString().padStart(2, '0')}`;
                          labelBottom = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                        }

                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={0} dy={20} textAnchor="middle" fill="#fff" fontSize={24}>
                              {labelTop}
                            </text>
                            {labelBottom && (
                              <text x={0} y={25} dy={20} textAnchor="middle" fill="#fff" fontSize={16} opacity={0.8}>
                                {labelBottom}
                              </text>
                            )}
                          </g>
                        );
                      }}
                      stroke="#fff"
                      minTickGap={40}
                      tickMargin={12}
                    />
                    
                    {(showTemp || showDew) && (
                      <YAxis 
                        yAxisId="left" 
                        stroke="#fff" 
                        fontSize={28} 
                        domain={tempAxis.domain} 
                        allowDataOverflow={true}
                        ticks={tempAxis.ticks}
                        tickFormatter={v => `${v}°C`}
                        width={90}
                      />
                    )}
                    
                    {showWind && (
                      <YAxis 
                        yAxisId="wind" 
                        orientation={(showTemp || showDew) ? "right" : "left"} 
                        stroke="#fff" 
                        fontSize={28} 
                        domain={windAxis.domain}
                        allowDataOverflow={true}
                        ticks={windAxis.ticks} 
                        tickFormatter={v => `${v} km/h`}
                        width={130}
                      />
                    )}
                    
                    {showPressure && (
                      <YAxis 
                        yAxisId="pressure" 
                        orientation={(showTemp || showDew) ? "right" : (showWind ? "right" : "left")} 
                        stroke="#fff" 
                        fontSize={28} 
                        domain={pressureAxis.domain} 
                        allowDataOverflow={true}
                        ticks={pressureAxis.ticks}
                        tickFormatter={v => `${v} hPa`}
                        width={130}
                      />
                    )}
                    
                    <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                    <Legend wrapperStyle={{ fontSize: '18px', paddingTop: '20px' }} />
                    
                    {(showTemp || showDew) && <ReferenceLine yAxisId="left" y={0} stroke="#fff" strokeWidth={1} strokeDasharray="4 4" />}
                    
                    {showTemp && <Line yAxisId="left" type="monotone" dataKey="tmpc" name="Temperatura" stroke={tempColor} dot={false} strokeWidth={lineWidth} isAnimationActive={false} />}
                    {showDew && <Line yAxisId="left" type="monotone" dataKey="dwpc" name="Punkt Rosy" stroke={dewColor} dot={false} strokeWidth={lineWidth} isAnimationActive={false} />}
                    {showWind && <Line yAxisId="wind" type="monotone" dataKey="windKmh" name="Wiatr" stroke={windColor} dot={false} strokeWidth={lineWidth} isAnimationActive={false} />}
                    {showPressure && <Line yAxisId="pressure" type="monotone" dataKey="pressureHpa" name="Ciśnienie" stroke={pressureColor} dot={false} strokeWidth={lineWidth} isAnimationActive={false} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 uppercase font-bold tracking-widest text-xl">
            Pobierz dane, aby wyświetlić wykres
          </div>
        )}
      </div>
      
      <div className="bg-[#1A1C1E] p-2 text-[10px] text-center text-white uppercase tracking-widest font-bold z-20">
        Źródło: Iowa Environmental Mesonet | Zmiana przybliżenia: Scroll | Przesuwanie: Left Click + Drag
      </div>
    </div>
  );
}
