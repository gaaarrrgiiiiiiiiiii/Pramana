"use client";
import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Crosshair, Radio, Satellite } from "lucide-react";

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
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
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

// Crime category → color mapping (neon palette)
const CRIME_COLORS: Record<string, string> = {
  "THEFT":                       "#ef4444", // red
  "MURDER":                      "#a855f7", // purple
  "RAPE":                        "#ec4899", // pink
  "ASSAULT":                     "#f97316", // orange
  "KIDNAPPING AND ABDUCTION":    "#eab308", // yellow
  "FRAUD":                       "#06b6d4", // cyan
  "CYBERCRIME":                  "#3b82f6", // blue
  "ROBBERY":                     "#f43f5e", // rose
  "DACOITY":                     "#c084fc", // violet
  "BURGLARY":                    "#fb923c", // amber-orange
  "NARCOTICS":                   "#84cc16", // lime
  "ACCIDENT":                    "#94a3b8", // slate
  "MISSING PERSON":              "#67e8f9", // light cyan
  "CASES OF HURT":               "#fca5a5", // light red
  "MOLESTATION":                 "#f9a8d4", // light pink
  "DEFAULT":                     "#00ff88", // neon green
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
  const [L, setL] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    import("leaflet").then((leaflet) => {
      setL(leaflet.default || leaflet);
    });
  }, []);

  // Dynamic filter sync from AI query
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

  // Karnataka geographic center and bounds
  // Karnataka bounding box: lat 11.59–18.45, lon 74.05–78.57
  const KARNATAKA_CENTER: [number, number] = [15.3173, 75.7139];
  const KARNATAKA_ZOOM = 7;

  const years = ["All", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"];

  useEffect(() => {
    setMounted(true);
    fetch(`${API_URL}/api/hotspots/filters`)
      .then((res) => res.json())
      .then((data) => {
        setCrimeGroups(data.crime_groups || []);
        setDistricts(data.districts || []);
      })
      .catch((err) => console.error("Error fetching hotspot filters:", err));
  }, [API_URL]);


  const fetchHotspots = useCallback(() => {
    if (!mounted) return;
    setLoading(true);

    // Fetch 1000 points for a richer map
    let url = `${API_URL}/api/hotspots?limit=1000`;
    if (selectedGroup !== "All") url += `&crime_group=${encodeURIComponent(selectedGroup)}`;
    if (selectedDistrict !== "All") url += `&district=${encodeURIComponent(selectedDistrict)}`;
    if (selectedYear !== "All") url += `&year=${selectedYear}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const raw: HotspotFeature[] = data.features || [];
        // Filter: only valid Karnataka coordinates
        const valid = raw.filter((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return (
            lat >= 11.59 && lat <= 18.45 &&
            lng >= 74.05 && lng <= 78.57
          );
        });
        setFeatures(valid);
        setTotalCount(data.count || raw.length);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching hotspots:", err);
        setLoading(false);
      });
  }, [selectedGroup, selectedDistrict, selectedYear, mounted, API_URL]);

  useEffect(() => {
    fetchHotspots();
  }, [fetchHotspots]);

  if (!mounted) return null;

  // Compute top crime groups from visible features
  const crimeCounts = features.reduce((acc: Record<string, number>, f) => {
    const cg = f.properties.crime_group || "Unknown";
    acc[cg] = (acc[cg] || 0) + 1;
    return acc;
  }, {});
  const topCrimes = Object.entries(crimeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="w-full h-full flex flex-col bg-[#050a0e] text-[#e0e7ef] relative overflow-hidden">
      {/* ── Tactical HUD Corners ── */}
      <div className="hud-corner hud-corner--tl" />
      <div className="hud-corner hud-corner--tr" />
      <div className="hud-corner hud-corner--bl" />
      <div className="hud-corner hud-corner--br" />

      {/* ── Filter Toolbar ── */}
      <div className="p-3 bg-[#0a1018]/90 backdrop-blur-xl border-b border-[#1e3a50] flex flex-wrap items-center justify-between gap-3 z-20 relative overflow-hidden">
        {/* Sweep glow line */}
        <div className="absolute inset-0 glow-line-sweep pointer-events-none" />

        <div className="flex items-center flex-wrap gap-3 text-xs relative z-10">
          <span className="flex items-center space-x-1.5 font-semibold text-[#00ff88] uppercase tracking-wider text-[10px]">
            <Satellite className="w-3.5 h-3.5 status-live" />
            <span>Tactical Hotspot View</span>
          </span>

          <div>
            <label className="mr-1 text-[#4a6580]">Crime:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-[#0a1018] border border-[#1e3a50] rounded-lg px-2 py-1 text-[#e0e7ef] outline-none focus:border-[#00ff88] text-xs transition-all duration-300 cursor-pointer"
            >
              <option value="All">All Categories</option>
              {crimeGroups.map((cg) => (
                <option key={cg} value={cg}>{cg}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mr-1 text-[#4a6580]">District:</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-[#0a1018] border border-[#1e3a50] rounded-lg px-2 py-1 text-[#e0e7ef] outline-none focus:border-[#00ff88] text-xs transition-all duration-300 cursor-pointer"
            >
              <option value="All">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mr-1 text-[#4a6580]">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-[#0a1018] border border-[#1e3a50] rounded-lg px-2 py-1 text-[#e0e7ef] outline-none focus:border-[#00ff88] text-xs transition-all duration-300 cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-[#4a6580] text-right relative z-10 flex items-center space-x-2">
          <Radio className="w-3.5 h-3.5 text-[#00ff88] status-live" />
          <span>
            <span className="text-[#00ff88] font-bold">{features.length.toLocaleString()}</span>
            {" "}verified pins
          </span>
          {totalCount > features.length && (
            <span className="text-[#4a6580]">(of {totalCount.toLocaleString()})</span>
          )}
        </div>
      </div>

      {/* ── Map Area ── */}
      <div className="flex-1 relative z-10 overflow-hidden">
        {/* Radar Sweep Overlay */}
        <div className="radar-sweep" />

        {/* Sonar Pulse Rings */}
        <div className="sonar-ring" />
        <div className="sonar-ring" />
        <div className="sonar-ring" />

        {/* Grid Overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-[16] grid-animated"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,255,136,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.12) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        {/* Crosshair Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[17]">
          <Crosshair className="w-8 h-8 text-[#00ff88] opacity-20" />
        </div>

        {loading && (
          <div className="absolute inset-0 bg-[#050a0e]/80 z-30 flex flex-col items-center justify-center space-y-3">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 w-12 h-12 border border-[rgba(0,255,136,0.2)] rounded-full animate-ping" />
            </div>
            <span className="text-xs text-[#8ba3be] tracking-wider uppercase">Scanning Karnataka...</span>
          </div>
        )}

        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

        <MapContainer
          center={KARNATAKA_CENTER}
          zoom={KARNATAKA_ZOOM}
          style={{ width: "100%", height: "100%", background: "transparent" }}
          maxBounds={[[11.0, 73.5], [19.0, 79.5]]}
          maxBoundsViscosity={0.8}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {/* ── Simulated Network Connections (Glowing Lines) ── */}
          {features.length > 1 && (
            <Polyline 
              positions={features.slice(0, Math.min(features.length, 50)).map(f => {
                const [lng, lat] = f.geometry.coordinates;
                return [lat, lng];
              })}
              pathOptions={{
                color: "#00f0ff",
                weight: 2,
                className: "tactical-polyline"
              }}
            />
          )}

          {features.map((f, i) => {
            const [lng, lat] = f.geometry.coordinates;
            const color = getCrimeColor(f.properties.crime_group);
            
            // Create a glowing tactical marker icon (3D Pin)
            const customIcon = L ? L.divIcon({
              className: 'tactical-pin-container',
              html: `
                <div style="--pin-color: ${color}">
                  <div class="tactical-pin-glow"></div>
                  <div class="tactical-pin" style="background: ${color}"></div>
                </div>
              `,
              iconSize: [28, 28],
              iconAnchor: [0, 0] // Centered at the base of the teardrop
            }) : undefined;

            return customIcon ? (
              <Marker
                key={i}
                position={[lat, lng]}
                icon={customIcon}
              >
                <Popup>
                  <div className="text-xs min-w-[180px] p-1">
                    <p
                      className="font-bold text-sm mb-1.5"
                      style={{ color }}
                    >
                      {f.properties.crime_group || "Unknown Crime"}
                    </p>
                    <div className="space-y-1 text-[#8ba3be]">
                      <p><span className="text-[#4a6580]">District:</span> <span className="text-[#e0e7ef]">{f.properties.district}</span></p>
                      <p><span className="text-[#4a6580]">Station:</span> <span className="text-[#e0e7ef]">{f.properties.unit}</span></p>
                      <p><span className="text-[#4a6580]">Place:</span> <span className="text-[#e0e7ef]">{f.properties.place}</span></p>
                      <p><span className="text-[#4a6580]">Year:</span> <span className="text-[#e0e7ef]">{f.properties.year}</span></p>
                    </div>
                    <p className="text-[#4a6580] text-[10px] mt-2 font-mono">
                      {lat.toFixed(5)}°N, {lng.toFixed(5)}°E
                    </p>
                  </div>
                </Popup>
              </Marker>
            ) : null;
          })}
        </MapContainer>
      </div>

      {/* ── Soft Glass Legend ── */}
      <div className="absolute bottom-6 left-6 z-[400] bg-[#0f1523]/80 backdrop-blur-xl border border-[#1e293b]/50 p-4 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-w-[220px]">
        <h3 className="text-[#3b82f6] font-bold text-xs tracking-widest mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6] mr-2 animate-pulse"></span>
          CRIME LEGEND
        </h3>
        <div className="space-y-2">
          {topCrimes.map(([crime, count]) => (
            <div key={crime} className="flex items-center space-x-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: getCrimeColor(crime),
                  boxShadow: `0 0 6px ${getCrimeColor(crime)}80`,
                }}
              />
              <span className="text-[#8ba3be] truncate text-[10px] flex-1">{crime}</span>
              <span className="text-[#4a6580] text-[10px] font-mono">{count}</span>
            </div>
          ))}
          {topCrimes.length === 0 && (
            <p className="text-[#4a6580] text-[10px]">Select filters to view data</p>
          )}
          <div className="w-full h-px bg-[#1e293b] my-2"></div>
          <p className="text-[9px] text-[#4a6580] font-mono">SRC: Karnataka Police FIR Dataset</p>
        </div>
      </div>

      {/* ── Data Source Badge ── */}
      <div className="absolute top-16 right-3 bg-[#0f1523]/80 backdrop-blur-xl border border-[#1e293b]/50 rounded-xl px-3 py-1.5 text-[10px] text-[#3b82f6] z-20 flex items-center space-x-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] status-live" />
        <span className="font-mono text-[#8ba3be]">LIVE · <span className="text-white">{(487189).toLocaleString()}</span> records</span>
      </div>

      {/* ── Tactical Status Bar ── */}
      <div className="absolute bottom-6 right-6 z-[400] bg-[#0f1523]/80 backdrop-blur-xl border border-[#1e293b]/50 p-3 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col space-y-1 font-mono text-[10px]">
        <div className="flex justify-between w-32">
          <span className="text-[#4a6580]">LAT</span>
          <span className="text-[#3b82f6]">15.3173°N</span>
        </div>
        <div className="flex justify-between w-32">
          <span className="text-[#4a6580]">LNG</span>
          <span className="text-[#3b82f6]">75.7139°E</span>
        </div>
        <div className="flex justify-between w-32">
          <span className="text-[#4a6580]">RNG</span>
          <span className="text-[#3b82f6]">STATE-WIDE</span>
        </div>
      </div>
    </div>
  );
}
