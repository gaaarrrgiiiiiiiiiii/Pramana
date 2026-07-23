"use client";
import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

const NODE_COLORS: Record<string, string> = {
  investigator: "#3b82f6",  // blue  — officers/IOs
  station:      "#10b981",  // green — police stations
  case:         "#f59e0b",  // amber — FIR cases
  crime_group:  "#ef4444",  // red   — crime categories
};

const NODE_SHAPES: Record<string, string> = {
  investigator: "ellipse",
  station:      "round-rectangle",
  case:         "hexagon",
  crime_group:  "diamond",
};

const NODE_SIZES: Record<string, number> = {
  investigator: 40,
  station:      48,
  case:         28,
  crime_group:  44,
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

      // ── Stylesheet ───────────────────────────────────────────────
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: any) =>
              NODE_COLORS[(ele.data("type") as string)] ?? "#64748b",
            width:  (ele: any) => NODE_SIZES[(ele.data("type") as string)] ?? 32,
            height: (ele: any) => NODE_SIZES[(ele.data("type") as string)] ?? 32,
            shape:  (ele: any) =>
              (NODE_SHAPES[(ele.data("type") as string)] ?? "ellipse") as any,
            label:                "data(label)",
            color:                "#e2e8f0",
            "text-outline-color": "#0f172a",
            "text-outline-width": 2,
            "font-size":          9,
            "text-valign":        "bottom",
            "text-halign":        "center",
            "text-margin-y":      4,
            "border-width":       2,
            "border-color":       "#1e293b",
          } as any,
        },
        {
          selector: "edge",
          style: {
            // haystack = straight lines rendered WITHOUT needing computed endpoint positions
            // → completely eliminates "invalid endpoints" warnings
            "curve-style":             "haystack",
            "haystack-radius":         0,
            width:                     1.5,
            "line-color":              "#334155",
            label:                     "data(label)",
            "font-size":               8,
            color:                     "#64748b",
            "text-background-opacity": 1,
            "text-background-color":   "#0f172a",
            "text-background-padding": "2px",
          } as any,
        },
        {
          selector: "node:selected",
          style: { "border-color": "#60a5fa", "border-width": 3 } as any,
        },
        {
          selector: "edge:selected",
          style: { "line-color": "#60a5fa", width: 2.5 } as any,
        },
      ],

      // ── Layout ───────────────────────────────────────────────────
      // breadthfirst assigns stable positions immediately (no animation phase)
      // so edges never start with overlapping endpoints
      layout: {
        name:          "breadthfirst",
        padding:       40,
        spacingFactor: 1.5,
        animate:       false,  // instant positioning = zero overlap phase
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
      <div className="p-4 text-slate-500 w-full h-full flex flex-col items-center justify-center gap-3">
        <span className="text-4xl opacity-20">🕸️</span>
        <p className="text-sm">No network data generated for this query.</p>
        <p className="text-xs text-slate-600">
          Try: "Who is connected to Ravi?" or "Show connections for THEFT"
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 relative">
      {/* Cytoscape mount point — must have explicit dimensions from parent */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700 rounded-lg p-3 text-xs space-y-1.5 backdrop-blur-sm pointer-events-none">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-300 capitalize">
              {type.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>

      {/* Stats badge */}
      <div className="absolute top-3 right-3 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 backdrop-blur-sm pointer-events-none">
        {data.nodes.length} nodes · {data.edges?.length ?? 0} edges
      </div>
    </div>
  );
}
