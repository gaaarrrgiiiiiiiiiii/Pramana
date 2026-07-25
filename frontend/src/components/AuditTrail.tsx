"use client";
import React from "react";
import { Activity, ShieldCheck, Database, Network, GitBranch, Eye, AlertTriangle, Sparkles } from "lucide-react";

export default function AuditTrail({ auditTrail }: { auditTrail: string[] }) {
  if (!auditTrail || auditTrail.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#4a6580] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#0f1923] border border-[#152233] flex items-center justify-center">
          <Activity className="w-8 h-8 opacity-30" />
        </div>
        <p className="text-sm text-center px-4">No active query.<br/>The audit trail will appear here when agents start reasoning.</p>
      </div>
    );
  }

  const getStepStyle = (log: string) => {
    if (log.includes("Authenticating") || log.includes("RBAC cleared")) {
      return { Icon: ShieldCheck, color: "text-[#00ff88]", bg: "border-[rgba(0,255,136,0.2)]", glow: "bg-[rgba(0,255,136,0.08)]" };
    }
    if (log.includes("RBAC BLOCKED")) {
      return { Icon: ShieldCheck, color: "text-red-400", bg: "border-[rgba(239,68,68,0.2)]", glow: "bg-[rgba(239,68,68,0.08)]" };
    }
    if (log.includes("RouterAgent") || log.includes("Router")) {
      return { Icon: GitBranch, color: "text-[#a855f7]", bg: "border-[rgba(168,85,247,0.2)]", glow: "bg-[rgba(168,85,247,0.08)]" };
    }
    if (log.includes("QueryAgent")) {
      return { Icon: Database, color: "text-[#3b82f6]", bg: "border-[rgba(59,130,246,0.2)]", glow: "bg-[rgba(59,130,246,0.08)]" };
    }
    if (log.includes("NetworkAgent")) {
      return { Icon: Network, color: "text-[#06b6d4]", bg: "border-[rgba(6,182,212,0.2)]", glow: "bg-[rgba(6,182,212,0.08)]" };
    }
    if (log.includes("Synthesis")) {
      return { Icon: Eye, color: "text-[#f59e0b]", bg: "border-[rgba(245,158,11,0.2)]", glow: "bg-[rgba(245,158,11,0.08)]" };
    }
    if (log.includes("Skeptic") && log.includes("flagged")) {
      return { Icon: AlertTriangle, color: "text-[#f97316]", bg: "border-[rgba(249,115,22,0.2)]", glow: "bg-[rgba(249,115,22,0.08)]" };
    }
    if (log.includes("Skeptic")) {
      return { Icon: ShieldCheck, color: "text-[#00ff88]", bg: "border-[rgba(0,255,136,0.2)]", glow: "bg-[rgba(0,255,136,0.08)]" };
    }
    return { Icon: Activity, color: "text-[#4a6580]", bg: "border-[#152233]", glow: "bg-[#0f1923]" };
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center space-x-2 border-b border-[#152233] pb-4">
        <Sparkles className="w-5 h-5 text-[#00ff88]" />
        <h2 className="font-semibold text-white">System Audit Trail</h2>
      </div>

      <div className="relative border-l border-[#1e3a50] ml-3 space-y-5">
        {auditTrail.map((log, idx) => {
          const { Icon, color, bg, glow } = getStepStyle(log);
          return (
            <div key={idx} className="relative pl-6">
              <span className={`absolute -left-3.5 top-1 bg-[#0a1018] border rounded-full p-1 ${color} ${bg}`}>
                <Icon className="w-3 h-3" />
              </span>
              <div className={`rounded-xl p-3 text-sm text-[#8ba3be] border shadow-sm ${glow} ${bg}`}>
                {log}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
