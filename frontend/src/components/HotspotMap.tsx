"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import Leaflet components to avoid SSR 'window is not defined' errors
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
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    crime_group: string;
    district: string;
    unit: string;
    year: number;
    place: string;
  };
}

export default function HotspotMap() {
  const [features, setFeatures] = useState<HotspotFeature[]>([]);
  const [crimeGroups, setCrimeGroups] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All");
  const [loading, setLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    setMounted(true);
    // Fetch filter options
    fetch(`${API_URL}/api/hotspots/filters`)
      .then((res) => res.json())
      .then((data) => {
        setCrimeGroups(data.crime_groups || []);
        setDistricts(data.districts || []);
      })
      .catch((err) => console.error("Error fetching hotspot filters:", err));
  }, [API_URL]);

  useEffect(() => {
    if (!mounted) return;
    setLoading(true);
    let url = `${API_URL}/api/hotspots?limit=400`;
    if (selectedGroup !== "All") url += `&crime_group=${encodeURIComponent(selectedGroup)}`;
    if (selectedDistrict !== "All") url += `&district=${encodeURIComponent(selectedDistrict)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setFeatures(data.features || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching hotspots:", err);
        setLoading(false);
      });
  }, [selectedGroup, selectedDistrict, mounted, API_URL]);

  if (!mounted) return null;

  // Karnataka center lat/lon
  const center: [number, number] = [14.5204, 75.7224];

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 relative">
      {/* Top Filter Toolbar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-semibold text-slate-400">Filter Hotspots:</span>
          <div>
            <label className="mr-1 text-slate-500">Crime Category:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="All">All Categories</option>
              {crimeGroups.map((cg) => (
                <option key={cg} value={cg}>
                  {cg}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mr-1 text-slate-500">District:</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="All">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="text-emerald-400 font-bold">{features.length}</span> crime location pins
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative z-10 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 z-30 flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-300">Loading hotspot coordinates...</span>
          </div>
        )}

        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />

        <MapContainer
          center={center}
          zoom={7}
          style={{ width: "100%", height: "100%", background: "#090d16" }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {features.map((f, i) => {
            const [lng, lat] = f.geometry.coordinates;
            return (
              <CircleMarker
                key={i}
                center={[lat, lng]}
                radius={6}
                pathOptions={{
                  fillColor: "#ef4444",
                  fillOpacity: 0.7,
                  color: "#dc2626",
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="p-1 text-slate-900 text-xs">
                    <p className="font-bold text-red-700">{f.properties.crime_group}</p>
                    <p><strong>District:</strong> {f.properties.district}</p>
                    <p><strong>Unit:</strong> {f.properties.unit}</p>
                    <p><strong>Place:</strong> {f.properties.place}</p>
                    <p><strong>Year:</strong> {f.properties.year}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700 rounded-lg p-3 text-xs space-y-1.5 backdrop-blur-sm z-20">
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-red-500 border border-red-600"></span>
          <span className="text-slate-300">FIR Incident Location</span>
        </div>
        <p className="text-[10px] text-slate-500">Dark Carto tile layer for Karnataka Police</p>
      </div>
    </div>
  );
}
