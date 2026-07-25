"use client";
import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import { Sparkles } from "lucide-react";

// Premium color palette for node types
const NODE_COLORS: Record<string, string> = {
  investigator: "#3b82f6",  // Blue   — officers/IOs
  station:      "#10b981",  // Emerald — police stations
  case:         "#8b5cf6",  // Purple — FIR cases
  crime_group:  "#ef4444",  // Red    — crime categories
};

const NODE_SHAPES: Record<string, string> = {
  investigator: "ellipse",
  station:      "round-rectangle",
  case:         "hexagon",
  crime_group:  "diamond",
};

const NODE_SIZES: Record<string, number> = {
  investigator: 45,
  station:      52,
  case:         32,
  crime_group:  48,
};

export default function NetworkGraph({ data }: { data: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef        = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    // Guard: need both a valid container and real node data
    if (!containerRef.current || !data?.nodes?.length) return;

    // Build validated elements — filter any edge whose endpoints aren't in the node set
    const nodeIds = new Set<string>(data.nodes.map((n: any) => String(n.id)));

    const cyNodes: cytoscape.ElementDefinition[] = data.nodes.map((n: any) => ({
      group: "nodes" as const,
      data: { id: String(n.id), label: n.label ?? n.id, type: n.type ?? "case" },
    }));

    const cyEdges: cytoscape.ElementDefinition[] = (data.edges ?? [])
      .filter((e: any) => {
        const src = String(e.source);
        const tgt = String(e.target);
        // Drop orphan edges and self-loops — these cause the Cytoscape warning
        return nodeIds.has(src) && nodeIds.has(tgt) && src !== tgt;
      })
      .map((e: any) => ({
        group: "edges" as const,
        data: {
          source: String(e.source),
          target: String(e.target),
          label:  e.label ?? "",
        },
      }));

    // Destroy previous instance first to prevent the "notify" unmount crash
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements:  [...cyNodes, ...cyEdges],

      // ── Neon Stylesheet ───────────────────────────────────────
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: any) =>
              NODE_COLORS[(ele.data("type") as string)] ?? "#00ff88",
            "background-opacity": 1,
            width:  (ele: any) => NODE_SIZES[(ele.data("type") as string)] ?? 36,
            height: (ele: any) => NODE_SIZES[(ele.data("type") as string)] ?? 36,
            shape:  (ele: any) =>
              (NODE_SHAPES[(ele.data("type") as string)] ?? "ellipse") as any,
            label:                "data(label)",
            color:                "#ffffff",
            "text-outline-color": "#000000",
            "text-outline-width": 3,
            "font-size":          12,
            "font-weight":        "bold",
            "text-valign":        "bottom",
            "text-halign":        "center",
            "text-margin-y":      8,
            "border-width":       4,
            "border-color": "#ffffff",
            "border-opacity":     0.8,
            // Neon glow via overlay
            "overlay-padding":    "12px",
            "overlay-opacity":    0.2,
            "overlay-color": (ele: any) => NODE_COLORS[(ele.data("type") as string)] ?? "#00ff88",
          } as any,
        },
        {
          selector: "edge",
          style: {
            "curve-style":             "haystack",
            "haystack-radius":         0,
            width:                     2,
            "line-color":              "#1e3a50",
            "line-opacity":            0.7,
            label:                     "data(label)",
            "font-size":               8,
            color:                     "#4a6580",
            "text-background-opacity": 1,
            "text-background-color":   "#050a0e",
            "text-background-padding": "3px",
          } as any,
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#ffffff",
            "border-width": 6,
            "border-opacity": 1,
            "overlay-opacity": 0.4,
          } as any,
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#3b82f6",
            width: 4,
            "line-opacity": 1,
          } as any,
        },
        // Hover effects
        {
          selector: "node:active",
          style: {
            "overlay-opacity": 0.5,
          } as any,
        },
      ],

      // ── Layout ───────────────────────────────────────────
      layout: {
        name:          "breadthfirst",
        padding:       50,
        spacingFactor: 1.6,
        animate:       false,
        avoidOverlap:  true,
      } as any,

      minZoom:         0.05,
      maxZoom:         4,
      wheelSensitivity: 0.3,
    });

    cyRef.current = cy;

    // Cleanup on unmount or data change — prevents "Cannot read properties of null (notify)"
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [data]);

  if (!data?.nodes?.length) {
    return (
      <div className="p-4 w-full h-full flex flex-col items-center justify-center gap-4 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.06)_0%,_transparent_60%)]" />
        <div className="w-24 h-24 rounded-full bg-[#111827]/80 border border-[#3b82f6]/30 flex items-center justify-center relative z-10 backdrop-blur-xl shadow-[0_0_30px_rgba(37,99,235,0.15)]">
          <Sparkles className="w-10 h-10 text-[#3b82f6] opacity-80 animate-pulse" />
        </div>
        <p className="text-lg text-white font-semibold relative z-10 drop-shadow-md">No network data generated for this query.</p>
        <p className="text-sm text-[#8ba3be] relative z-10">
          Try asking: <span className="text-[#3b82f6]">"Who is connected to Ravi?"</span>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#050a0e] relative overflow-hidden">
      {/* ── Tactical Overlays ── */}
      <div className="hud-corner hud-corner--tl" />
      <div className="hud-corner hud-corner--tr" />
      <div className="hud-corner hud-corner--bl" />
      <div className="hud-corner hud-corner--br" />

      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none z-0 grid-animated"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,136,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,255,136,0.04)_0%,_transparent_50%)] pointer-events-none z-0" />

      {/* Cytoscape mount point */}
      <div ref={containerRef} className="w-full h-full relative z-10" />

      {/* ── Neon Legend ── */}
      <div className="absolute bottom-3 left-3 glass-strong rounded-xl p-3 text-xs space-y-2 pointer-events-none z-20 animate-border-glow">
        <p className="text-[10px] text-[#00ff88] font-semibold uppercase tracking-wider flex items-center space-x-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] status-live" />
          <span>Network Legend</span>
        </p>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}60`,
              }}
            />
            <span className="text-[#8ba3be] capitalize">
              {type.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>

      {/* ── Stats Badge ── */}
      <div className="absolute top-3 right-3 glass rounded-xl px-3 py-2 text-xs text-[#8ba3be] pointer-events-none z-20 font-mono space-y-0.5 animate-border-glow">
        <div className="flex items-center space-x-2">
          <span className="text-[#4a6580]">NODES</span>
          <span className="text-[#00ff88] font-bold">{data.nodes.length}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[#4a6580]">EDGES</span>
          <span className="text-[#3b82f6] font-bold">{data.edges?.length ?? 0}</span>
        </div>
      </div>

      {/* ── Scan Line ── */}
      <div className="absolute inset-0 pointer-events-none z-[18] scan-line" />
    </div>
  );
}
