/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Crosshair, Radio, Satellite, Globe, MapPin, ChevronDown, ChevronUp, Layers, Flame, ShieldAlert } from "lucide-react";

// Dynamically import Leaflet components to avoid SSR errors
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// MapViewController dynamically controls map view without unmounting MapContainer
const MapViewController = dynamic(
  () => import("react-leaflet").then((mod) => {
    const { useMap } = mod;
    return function ViewSetter({ center, zoom }: { center: [number, number]; zoom: number }) {
      const map = useMap();
      useEffect(() => {
        if (map && center) {
          try {
            map.setView(center, zoom, { animate: true });
          } catch {
            // ignore
          }
        }
      }, [center, zoom, map]);
      return null;
    };
  }),
  { ssr: false }
);

interface HotspotFeature {
  type: string;
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: {
    crime_group: string;
    district: string;
    unit: string;
    year: number;
    place: string;
  };
}

// Vibrant Neon Color Palette for Crime Categories
const CRIME_COLORS: Record<string, string> = {
  "THEFT":                       "#ef4444", // Neon Red
  "MURDER":                      "#a855f7", // Neon Purple
  "RAPE":                        "#ec4899", // Neon Pink
  "ASSAULT":                     "#f97316", // Neon Orange
  "KIDNAPPING AND ABDUCTION":    "#eab308", // Yellow
  "FRAUD":                       "#06b6d4", // Cyan
  "CYBERCRIME":                  "#3b82f6", // Neon Blue
  "ROBBERY":                     "#f43f5e", // Rose
  "DACOITY":                     "#c084fc", // Violet
  "BURGLARY":                    "#fb923c", // Amber
  "NARCOTICS":                   "#84cc16", // Lime Green
  "ACCIDENT":                    "#94a3b8", // Slate
  "MISSING PERSON":              "#67e8f9", // Light Cyan
  "CASES OF HURT":               "#fca5a5", // Coral Red
  "MOLESTATION":                 "#f9a8d4", // Light Pink
  "DEFAULT":                     "#00ff88", // Neon Mint Green
};

function getCrimeColor(crimeGroup: string): string {
  if (!crimeGroup) return CRIME_COLORS.DEFAULT;
  const upper = crimeGroup.toUpperCase();
  for (const [key, color] of Object.entries(CRIME_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return CRIME_COLORS.DEFAULT;
}

interface HotspotMapProps {
  initialFilters?: {
    district?: string;
    crime_group?: string;
    year?: number | string;
  };
}

export default function HotspotMap({ initialFilters }: HotspotMapProps = {}) {
  const [features, setFeatures] = useState<HotspotFeature[]>([]);
  const [crimeGroups, setCrimeGroups] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [loading, setLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState<boolean>(false);

  // Geographic center defaults
  const KARNATAKA_CENTER: [number, number] = [15.3173, 75.7139];
  const KARNATAKA_ZOOM = 7.2;
  const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
  const INDIA_ZOOM = 5;

  const [currentCenter, setCurrentCenter] = useState<[number, number]>(KARNATAKA_CENTER);
  const [currentZoom, setCurrentZoom] = useState<number>(KARNATAKA_ZOOM);
  const [viewMode, setViewMode] = useState<"karnataka" | "india">("karnataka");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://pramana-api-50044352049.development.catalystappsail.in";

  const FALLBACK_CRIME_GROUPS = [
    "THEFT", "MURDER", "RAPE", "ASSAULT", "KIDNAPPING AND ABDUCTION",
    "FRAUD", "CYBERCRIME", "ROBBERY", "DACOITY", "BURGLARY", "NARCOTICS",
    "ACCIDENT", "MISSING PERSON", "CASES OF HURT", "MOLESTATION"
  ];

  const FALLBACK_DISTRICTS = [
    "Bengaluru City", "Mysuru City", "Mangaluru City", "Hubballi-Dharwad",
    "Belagavi", "Kalaburagi", "Shivamogga", "Ballari", "Davangere", "Tumakuru"
  ];

  const years = ["All", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"];

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.district && initialFilters.district !== "All") {
        setSelectedDistrict(initialFilters.district);
      }
      if (initialFilters.crime_group && initialFilters.crime_group !== "All") {
        setSelectedGroup(initialFilters.crime_group);
      }
      if (initialFilters.year) {
        setSelectedYear(String(initialFilters.year));
      }
    }
  }, [initialFilters]);

  useEffect(() => {
    setMounted(true);
    fetch(`${API_URL}/api/hotspots/filters`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        setCrimeGroups(data.crime_groups && data.crime_groups.length > 0 ? data.crime_groups : FALLBACK_CRIME_GROUPS);
        setDistricts(data.districts && data.districts.length > 0 ? data.districts : FALLBACK_DISTRICTS);
      })
      .catch((err) => {
        console.warn("Could not connect to hotspot filters backend, using standard filters:", err.message || err);
        setCrimeGroups(FALLBACK_CRIME_GROUPS);
        setDistricts(FALLBACK_DISTRICTS);
      });
  }, [API_URL]);

  const fetchHotspots = useCallback(() => {
    if (!mounted) return;
    setLoading(true);
    setFetchError(null);

    let url = `${API_URL}/api/hotspots?limit=500`;
    if (selectedGroup !== "All") url += `&crime_group=${encodeURIComponent(selectedGroup)}`;
    if (selectedDistrict !== "All") url += `&district=${encodeURIComponent(selectedDistrict)}`;
    if (selectedYear !== "All") url += `&year=${selectedYear}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        const raw: HotspotFeature[] = data.features || [];
        const valid = raw.filter((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return (
            lat >= 11.0 && lat <= 19.0 &&
            lng >= 74.0 && lng <= 79.0
          );
        });
        setFeatures(valid);
        setTotalCount(data.count || raw.length);
        setLoading(false);
      })
      .catch((err) => {
        const errorMsg = `Unable to load hotspot data from backend (${API_URL}). Please verify backend server is running.`;
        console.warn("Error fetching hotspots:", err.message || err);
        setFetchError(errorMsg);
        setLoading(false);
      });
  }, [selectedGroup, selectedDistrict, selectedYear, mounted, API_URL]);

  useEffect(() => {
    fetchHotspots();
  }, [fetchHotspots]);

  const switchToKarnatakaView = () => {
    setViewMode("karnataka");
    setCurrentCenter(KARNATAKA_CENTER);
    setCurrentZoom(KARNATAKA_ZOOM);
  };

  const switchToIndiaView = () => {
    setViewMode("india");
    setCurrentCenter(INDIA_CENTER);
    setCurrentZoom(INDIA_ZOOM);
  };

  if (!mounted) return null;

  const crimeCounts = features.reduce((acc: Record<string, number>, f) => {
    const cg = f.properties.crime_group || "Unknown";
    acc[cg] = (acc[cg] || 0) + 1;
    return acc;
  }, {});

  const topCrimes = Object.entries(crimeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="w-full h-full flex flex-col bg-[#060b13] text-[#e0e7ef] relative overflow-hidden font-sans">
      {/* ── Tactical HUD Corners ── */}
      <div className="hud-corner hud-corner--tl" />
      <div className="hud-corner hud-corner--tr" />
      <div className="hud-corner hud-corner--bl" />
      <div className="hud-corner hud-corner--br" />

      {/* ── Premium Control Toolbar ── */}
      <div className="p-3 bg-[#070d16]/90 backdrop-blur-2xl border-b border-[#1e3a50]/70 flex flex-wrap items-center justify-between gap-3 z-20 relative shadow-lg">
        <div className="flex items-center flex-wrap gap-3 text-xs relative z-10">
          <span className="flex items-center space-x-1.5 font-bold text-[#00ff88] uppercase tracking-wider text-[11px] bg-[#00ff88]/10 border border-[#00ff88]/30 px-2.5 py-1 rounded-xl shadow-[0_0_12px_rgba(0,255,136,0.15)]">
            <Flame className="w-3.5 h-3.5 text-[#00ff88] animate-pulse" />
            <span>Karnataka Crime Hotspots</span>
          </span>

          <div className="flex items-center space-x-1.5">
            <span className="text-[#8ba3be] font-medium">Crime:</span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-[#0a121d] border border-[#1e3a50] rounded-xl px-2.5 py-1.5 text-white outline-none focus:border-[#00ff88] focus:shadow-[0_0_12px_rgba(0,255,136,0.2)] text-xs transition-all duration-300 cursor-pointer shadow-inner"
            >
              <option value="All">All Categories</option>
              {crimeGroups.map((cg) => (
                <option key={cg} value={cg}>{cg}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-[#8ba3be] font-medium">District:</span>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-[#0a121d] border border-[#1e3a50] rounded-xl px-2.5 py-1.5 text-white outline-none focus:border-[#00ff88] focus:shadow-[0_0_12px_rgba(0,255,136,0.2)] text-xs transition-all duration-300 cursor-pointer shadow-inner"
            >
              <option value="All">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-[#8ba3be] font-medium">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-[#0a121d] border border-[#1e3a50] rounded-xl px-2.5 py-1.5 text-white outline-none focus:border-[#00ff88] focus:shadow-[0_0_12px_rgba(0,255,136,0.2)] text-xs transition-all duration-300 cursor-pointer shadow-inner"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* View Switcher & Live Counter */}
        <div className="flex items-center space-x-3 text-xs relative z-10">
          <div className="flex items-center bg-[#050a0e] border border-[#1e3a50] rounded-xl p-1 space-x-1 shadow-inner">
            <button
              onClick={switchToKarnatakaView}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                viewMode === "karnataka"
                  ? "bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 shadow-[0_0_12px_rgba(0,255,136,0.25)]"
                  : "text-[#8ba3be] hover:text-white"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Karnataka Focus</span>
            </button>

            <button
              onClick={switchToIndiaView}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                viewMode === "india"
                  ? "bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                  : "text-[#8ba3be] hover:text-white"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>India View</span>
            </button>
          </div>

          <div className="text-[#8ba3be] flex items-center space-x-2 font-mono bg-[#050a0e] border border-[#1e3a50] px-3 py-1 rounded-xl">
            <Radio className="w-3.5 h-3.5 text-[#00ff88] status-live animate-pulse" />
            <span className="text-[#00ff88] font-bold">{features.length.toLocaleString()}</span>
            <span>verified pins</span>
          </div>
        </div>
      </div>

      {/* ── Offline/Error Banner ── */}
      {fetchError && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 px-4 py-2 text-amber-300 text-xs flex items-center justify-between z-30 relative shadow-lg">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="font-semibold uppercase tracking-wider text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Backend Offline</span>
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => fetchHotspots()}
            className="text-[11px] underline hover:text-amber-200 cursor-pointer ml-4 font-medium"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Map Display Area ── */}
      <div className="flex-1 relative z-10 overflow-hidden">
        {/* Tactical Crosshair */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[17]">
          <Crosshair className="w-10 h-10 text-[#00ff88] opacity-25" />
        </div>

        {loading && (
          <div className="absolute inset-0 bg-[#060b13]/85 z-30 flex flex-col items-center justify-center space-y-3 backdrop-blur-md">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 w-12 h-12 border border-[rgba(0,255,136,0.3)] rounded-full animate-ping" />
            </div>
            <span className="text-xs text-[#00ff88] font-semibold tracking-wider uppercase">Loading Tactical GIS Intel...</span>
          </div>
        )}

        <MapContainer
          center={KARNATAKA_CENTER}
          zoom={KARNATAKA_ZOOM}
          preferCanvas={true}
          style={{ width: "100%", height: "100%", background: "#060b13" }}
          maxBounds={[[11.0, 73.5], [19.0, 79.5]]}
          maxBoundsViscosity={0.8}
        >
          {/* Dynamic map view controller */}
          <MapViewController center={currentCenter} zoom={currentZoom} />

          {/* Base Map Layer: Esri World Dark Gray Canvas for clear dark landmasses and blue water */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri, HERE, Garmin, FAO, USGS"
            maxZoom={18}
          />

          {/* Overlay Map Layer: CartoDB Dark Only Labels for crystal clear silver city & state names */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
            maxZoom={18}
          />

          {/* Tactical Network Polyline Connections */}
          {features.length > 1 && (
            <Polyline 
              positions={features.slice(0, Math.min(features.length, 25)).map(f => {
                const [lng, lat] = f.geometry.coordinates;
                return [lat, lng];
              })}
              pathOptions={{
                color: "#00f0ff",
                weight: 1.5,
                opacity: 0.5,
                dashArray: "5, 7"
              }}
            />
          )}

          {/* Glowing Precise Hotspot Pins */}
          {features.map((f, i) => {
            const [lng, lat] = f.geometry.coordinates;
            const color = getCrimeColor(f.properties.crime_group);

            return (
              <React.Fragment key={`hotspot-group-${i}`}>
                {/* Glowing Outer Pulsing Ring for High Density Pins */}
                {i < 25 && (
                  <CircleMarker
                    key={`pulse-${i}`}
                    center={[lat, lng]}
                    radius={10}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: 0.25,
                      weight: 1,
                      className: "hotspot-pulse-ring"
                    }}
                  />
                )}

                {/* Core Circle Marker */}
                <CircleMarker
                  key={`core-${i}`}
                  center={[lat, lng]}
                  radius={6}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.9,
                    weight: 2,
                    className: "hotspot-glow-marker"
                  }}
                >
                  <Popup>
                    <div className="text-xs min-w-[200px] p-1 font-sans">
                      <p
                        className="font-bold text-sm mb-2 flex items-center justify-between border-b border-[#1e3a50]/60 pb-1.5"
                        style={{ color }}
                      >
                        <span>{f.properties.crime_group || "Unknown Crime"}</span>
                        <span className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] border border-white/50" style={{ backgroundColor: color }} />
                      </p>
                      <div className="space-y-1.5 text-[#8ba3be]">
                        <p className="flex justify-between"><span className="text-[#4a6580]">District:</span> <span className="text-white font-semibold">{f.properties.district}</span></p>
                        <p className="flex justify-between"><span className="text-[#4a6580]">Station:</span> <span className="text-[#00ff88] font-semibold">{f.properties.unit}</span></p>
                        <p className="flex justify-between"><span className="text-[#4a6580]">Place:</span> <span className="text-[#e0e7ef] font-medium truncate max-w-[130px]">{f.properties.place}</span></p>
                        <p className="flex justify-between"><span className="text-[#4a6580]">Year:</span> <span className="text-white font-mono font-medium">{f.properties.year}</span></p>
                      </div>
                      <p className="text-[#4a6580] text-[10px] mt-2.5 font-mono border-t border-[#1e3a50]/50 pt-1 flex justify-between">
                        <span>GPS Coordinates</span>
                        <span className="text-[#00f0ff]">{lat.toFixed(5)}°N, {lng.toFixed(5)}°E</span>
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* ── Glassmorphic Legend (Positioned on Bottom-Right) ── */}
      <div className="absolute bottom-6 right-6 z-[400] bg-[#070d16]/95 backdrop-blur-2xl border border-[#1e3a50]/80 p-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-w-[250px] transition-all duration-300">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}>
          <h3 className="text-[#00ff88] font-bold text-xs tracking-widest flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <Layers className="w-4 h-4 text-[#00ff88]" />
            <span>HOTSPOT LEGEND</span>
          </h3>
          <button className="text-[#8ba3be] hover:text-white p-0.5 rounded transition-colors">
            {isLegendCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {!isLegendCollapsed && (
          <div className="space-y-2 text-xs mt-3.5 border-t border-[#1e3a50]/60 pt-3">
            {topCrimes.map(([crime, count]) => (
              <div key={crime} className="flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <div
                    className="w-3.5 h-3.5 rounded-full shadow-[0_0_10px_currentColor] border border-white/40 flex-shrink-0"
                    style={{ backgroundColor: getCrimeColor(crime), color: getCrimeColor(crime) }}
                  />
                  <span className="text-[#e0e7ef] text-[11px] font-medium truncate max-w-[135px]">{crime}</span>
                </div>
                <span className="text-[#00ff88] font-mono text-[10px] font-bold bg-[#00ff88]/10 px-2 py-0.5 rounded-md border border-[#00ff88]/30 ml-2">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
