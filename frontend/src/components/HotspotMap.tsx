"use client";
import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

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

// Crime category → color mapping
const CRIME_COLORS: Record<string, string> = {
  "THEFT":                       "#ef4444", // red
  "MURDER":                      "#7c3aed", // purple
  "RAPE":                        "#db2777", // pink
  "ASSAULT":                     "#f97316", // orange
  "KIDNAPPING AND ABDUCTION":    "#eab308", // yellow
  "FRAUD":                       "#06b6d4", // cyan
  "CYBERCRIME":                  "#3b82f6", // blue
  "ROBBERY":                     "#f43f5e", // rose
  "DACOITY":                     "#a855f7", // violet
  "BURGLARY":                    "#fb923c", // amber-orange
  "NARCOTICS":                   "#84cc16", // lime
  "ACCIDENT":                    "#94a3b8", // slate (grey)
  "MISSING PERSON":              "#67e8f9", // light cyan
  "CASES OF HURT":               "#fca5a5", // light red
  "MOLESTATION":                 "#f9a8d4", // light pink
  "DEFAULT":                     "#64748b", // slate grey
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 relative">
      {/* Filter Toolbar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center flex-wrap gap-3 text-xs">
          <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
            🗺 Hotspot Filters
          </span>

          <div>
            <label className="mr-1 text-slate-500">Crime:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-emerald-500 text-xs"
            >
              <option value="All">All Categories</option>
              {crimeGroups.map((cg) => (
                <option key={cg} value={cg}>{cg}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mr-1 text-slate-500">District:</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-emerald-500 text-xs"
            >
              <option value="All">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mr-1 text-slate-500">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-emerald-500 text-xs"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 text-right">
          Showing{" "}
          <span className="text-emerald-400 font-bold">{features.length.toLocaleString()}</span>
          {" "}verified Karnataka pins
          {totalCount > features.length && (
            <span className="text-slate-500 ml-1">(of {totalCount.toLocaleString()} total)</span>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative z-10 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 z-30 flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-300">Loading Karnataka crime locations...</span>
          </div>
        )}

        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

        <MapContainer
          center={KARNATAKA_CENTER}
          zoom={KARNATAKA_ZOOM}
          style={{ width: "100%", height: "100%", background: "#090d16" }}
          maxBounds={[[11.0, 73.5], [19.0, 79.5]]}
          maxBoundsViscosity={0.8}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {features.map((f, i) => {
            const [lng, lat] = f.geometry.coordinates;
            const color = getCrimeColor(f.properties.crime_group);
            return (
              <CircleMarker
                key={i}
                center={[lat, lng]}
                radius={5}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.75,
                  color: color,
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="text-xs text-slate-900 min-w-[160px]">
                    <p
                      className="font-bold text-sm mb-1"
                      style={{ color }}
                    >
                      {f.properties.crime_group || "Unknown Crime"}
                    </p>
                    <p><strong>District:</strong> {f.properties.district}</p>
                    <p><strong>Station:</strong> {f.properties.unit}</p>
                    <p><strong>Place:</strong> {f.properties.place}</p>
                    <p><strong>Year:</strong> {f.properties.year}</p>
                    <p className="text-slate-500 text-[10px] mt-1">
                      {lat.toFixed(5)}°N, {lng.toFixed(5)}°E
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend — top crime types in current view */}
      <div className="absolute bottom-4 left-3 bg-slate-900/95 border border-slate-700 rounded-xl p-3 text-xs space-y-1.5 backdrop-blur-sm z-20 shadow-xl max-w-[200px]">
        <p className="font-semibold text-slate-300 mb-2 uppercase tracking-wider text-[10px]">
          📍 Crime Legend
        </p>
        {topCrimes.map(([crime, count]) => (
          <div key={crime} className="flex items-center space-x-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: getCrimeColor(crime) }}
            />
            <span className="text-slate-300 truncate text-[10px]">{crime}</span>
            <span className="text-slate-500 ml-auto text-[10px]">{count}</span>
          </div>
        ))}
        {topCrimes.length === 0 && (
          <p className="text-slate-500 text-[10px]">Select filters to view data</p>
        )}
        <div className="pt-1 border-t border-slate-700 text-[9px] text-slate-600">
          Data: Karnataka Police FIR Dataset (Kaggle)
        </div>
      </div>

      {/* Data source badge */}
      <div className="absolute top-16 right-3 bg-emerald-900/40 border border-emerald-700/50 rounded-lg px-2 py-1 text-[10px] text-emerald-400 z-20">
        ✓ Real FIR data · {(487189).toLocaleString()} geotagged records
      </div>
    </div>
  );
}
