/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { Sparkles, Shield, AlertTriangle, ArrowRight, X } from "lucide-react";

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
  investigator: 48,
  station:      52,
  case:         34,
  crime_group:  48,
};

export default function NetworkGraph({ data }: { data: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef        = useRef<cytoscape.Core | null>(null);
  const [selectedPathNodes, setSelectedPathNodes] = useState<string[] | null>(null);

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

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements:  [...cyNodes, ...cyEdges],

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
            "text-outline-color": "#050a0e",
            "text-outline-width": 3,
            "font-size":          11,
            "font-weight":        "bold",
            "text-valign":        "bottom",
            "text-halign":        "center",
            "text-margin-y":      8,
            "text-wrap":          "wrap",
            "text-max-width":     "110px",
            "border-width":       3,
            "border-color":       "#ffffff",
            "border-opacity":     0.8,
            "overlay-padding":    "12px",
            "overlay-opacity":    0.2,
            "overlay-color": (ele: any) => NODE_COLORS[(ele.data("type") as string)] ?? "#00ff88",
            "transition-property": "opacity, border-color, border-width",
            "transition-duration": 0.3,
          } as any,
        },
        {
          selector: "edge",
          style: {
            "curve-style":             "bezier",
            width:                     2.5,
            "line-color":              "#1e3a50",
            "line-opacity":            0.7,
            label:                     "data(label)",
            "font-size":               8,
            color:                     "#8ba3be",
            "text-background-opacity": 1,
            "text-background-color":   "#050a0e",
            "text-background-padding": "3px",
            "transition-property": "line-color, width, opacity",
            "transition-duration": 0.3,
          } as any,
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#ffffff",
            "border-width": 5,
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
        /* Highlight path connection from leaf node to main entity */
        {
          selector: ".path-highlight",
          style: {
            "line-color": "#00ff88",
            "target-arrow-color": "#00ff88",
            width: 5,
            "line-opacity": 1,
            "border-color": "#00ff88",
            "border-width": 5,
            "border-opacity": 1,
            "overlay-color": "#00ff88",
            "overlay-opacity": 0.4,
            opacity: 1,
            "z-index": 999
          } as any,
        },
        {
          selector: "node.selected-leaf",
          style: {
            "border-color": "#00f0ff",
            "border-width": 6,
            "overlay-color": "#00f0ff",
            "overlay-opacity": 0.6,
            opacity: 1,
            "z-index": 1000
          } as any,
        },
        {
          selector: "node.main-entity-target",
          style: {
            "border-color": "#00ff88",
            "border-width": 6,
            "overlay-color": "#00ff88",
            "overlay-opacity": 0.6,
            opacity: 1,
            "z-index": 1000
          } as any,
        },
        {
          selector: ".path-dimmed",
          style: {
            opacity: 0.15,
            "text-opacity": 0.2,
          } as any,
        },
      ],

      layout: {
        name:          "breadthfirst",
        padding:       40,
        spacingFactor: 1.5,
        animate:       false,
        avoidOverlap:  true,
      } as any,

      minZoom:         0.05,
      maxZoom:         4,
      wheelSensitivity: 0.3,
    });

    // Node click/tap event listener: trace leaf node to main entity path
    const findMainEntityNode = () => {
      const targetTerm = (data.target || "").toLowerCase();
      let mainNode: any = null;

      if (targetTerm) {
        mainNode = cy.nodes().filter((n: any) => {
          const label = (n.data("label") || "").toLowerCase();
          const id = (n.data("id") || "").toLowerCase();
          return label.includes(targetTerm) || id.includes(targetTerm);
        })[0];
      }

      if (!mainNode) {
        const investigators = cy.nodes('[type = "investigator"]');
        if (investigators.length > 0) mainNode = investigators[0];
      }

      if (!mainNode) {
        let maxDeg = -1;
        cy.nodes().forEach((n: any) => {
          const d = n.degree();
          if (d > maxDeg) {
            maxDeg = d;
            mainNode = n;
          }
        });
      }

      return mainNode;
    };

    cy.on("tap", "node", (evt: any) => {
      const node = evt.target;
      const mainNode = findMainEntityNode();

      cy.elements().removeClass("path-highlight path-dimmed selected-leaf main-entity-target");

      if (!mainNode || mainNode.id() === node.id()) {
        const neighbors = node.closedNeighborhood();
        neighbors.addClass("path-highlight");
        node.addClass("main-entity-target");
        cy.elements().difference(neighbors).addClass("path-dimmed");
        setSelectedPathNodes([node.data("label")]);
        return;
      }

      // Compute shortest graph path connecting selected node (leaf) to main entity node
      const astar = cy.elements().aStar({
        root: node,
        goal: mainNode,
        directed: false,
      });

      if (astar.found) {
        const pathElems = astar.path;
        pathElems.addClass("path-highlight");
        node.addClass("selected-leaf");
        mainNode.addClass("main-entity-target");
        cy.elements().difference(pathElems).addClass("path-dimmed");

        const pathNodes = astar.path.filter("node");
        const labels = pathNodes.map((n: any) => n.data("label"));
        setSelectedPathNodes(labels);
      } else {
        const neighborhood = node.closedNeighborhood();
        neighborhood.addClass("path-highlight");
        node.addClass("selected-leaf");
        cy.elements().difference(neighborhood).addClass("path-dimmed");
        setSelectedPathNodes([node.data("label"), mainNode.data("label")]);
      }
    });

    cy.on("tap", (evt: any) => {
      if (evt.target === cy) {
        cy.elements().removeClass("path-highlight path-dimmed selected-leaf main-entity-target");
        setSelectedPathNodes(null);
      }
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [data]);

  const clearSelection = () => {
    if (cyRef.current) {
      cyRef.current.elements().removeClass("path-highlight path-dimmed selected-leaf main-entity-target");
    }
    setSelectedPathNodes(null);
  };

  if (!data?.nodes?.length) {
    return (
      <div className="p-4 w-full h-full flex flex-col items-center justify-center gap-4 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,255,136,0.05)_0%,_transparent_60%)]" />
        <div className="w-24 h-24 rounded-full bg-[#111827]/80 border border-[#00ff88]/30 flex items-center justify-center relative z-10 backdrop-blur-xl shadow-[0_0_30px_rgba(0,255,136,0.2)]">
          <Sparkles className="w-10 h-10 text-[#00ff88] opacity-90 animate-pulse" />
        </div>
        <p className="text-lg text-white font-semibold relative z-10 drop-shadow-md">No network data generated for this query.</p>
        <p className="text-sm text-[#8ba3be] relative z-10 text-center">
          Try asking: <span className="text-[#00ff88] font-semibold">&quot;Show criminal network for CYBER CRIME&quot;</span> or <span className="text-[#00ff88] font-semibold">&quot;Cases investigated by CHANDRAKALA M B&quot;</span>
        </p>
      </div>
    );
  }

  const isInvestigatorTarget = data.target_type === "investigator";

  return (
    <div className="w-full h-full bg-[#050a0e] relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none z-0 grid-animated"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,136,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,255,136,0.04)_0%,_transparent_50%)] pointer-events-none z-0" />

      {/* Cytoscape mount point */}
      <div ref={containerRef} className="w-full h-full relative z-10" />

      {/* Interactive Path Trace Banner when a node/leaf is clicked */}
      {selectedPathNodes && selectedPathNodes.length > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#0a1018]/95 border border-[#00ff88]/50 rounded-2xl px-4 py-2.5 z-30 shadow-[0_0_30px_rgba(0,255,136,0.3)] backdrop-blur-xl flex items-center space-x-3 max-w-xl animate-in fade-in">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00ff88] bg-[#00ff88]/20 px-2 py-0.5 rounded whitespace-nowrap">
            Leaf to Main Entity Path
          </span>
          <div className="flex items-center space-x-1.5 text-xs font-mono text-white overflow-x-auto py-0.5 scrollbar-none">
            {selectedPathNodes.map((label, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-[#00ff88] flex-shrink-0" />}
                <span
                  className={`px-2 py-0.5 rounded text-[11px] whitespace-nowrap ${
                    idx === 0
                      ? "bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold"
                      : idx === selectedPathNodes.length - 1
                      ? "bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40 font-bold"
                      : "bg-[#152233] text-[#e0e7ef] border border-[#1e3a50]"
                  }`}
                >
                  {label}
                </span>
              </React.Fragment>
            ))}
          </div>
          <button
            onClick={clearSelection}
            className="p-1 hover:bg-[#152233] text-[#8ba3be] hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Reset Path Selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Target Title Badge (Top Left) */}
      <div className="absolute top-16 left-4 bg-[#111827]/90 border border-[#1e293b] rounded-2xl px-4 py-2.5 z-20 shadow-xl backdrop-blur-md">
        <div className="flex items-center space-x-2">
          {isInvestigatorTarget ? (
            <Shield className="w-4 h-4 text-[#3b82f6]" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
          )}
          <span className="text-xs font-bold text-white tracking-wide">
            {isInvestigatorTarget ? "Investigative Work Network" : "Criminal Network Graph"}
          </span>
        </div>
        {data.target && (
          <p className="text-[11px] text-[#00ff88] font-mono mt-0.5">
            Target: {data.target}
          </p>
        )}
      </div>

      {/* Neon Legend */}
      <div className="absolute bottom-3 left-3 bg-[#0a1018]/90 border border-[#152233] rounded-xl p-3 text-xs space-y-2 pointer-events-none z-20 backdrop-blur-md shadow-xl">
        <p className="text-[10px] text-[#00ff88] font-semibold uppercase tracking-wider flex items-center space-x-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          <span>Entity Legend (Click node to trace path)</span>
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

      {/* Stats Badge */}
      <div className="absolute top-16 right-4 bg-[#0a1018]/90 border border-[#152233] rounded-xl px-3 py-2 text-xs text-[#8ba3be] pointer-events-none z-20 font-mono space-y-0.5 backdrop-blur-md shadow-xl">
        <div className="flex items-center space-x-2">
          <span className="text-[#4a6580]">NODES</span>
          <span className="text-[#00ff88] font-bold">{data.nodes.length}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[#4a6580]">EDGES</span>
          <span className="text-[#3b82f6] font-bold">{data.edges?.length ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
