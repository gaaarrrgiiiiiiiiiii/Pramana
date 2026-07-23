"use client";
import React from "react";
import { Activity, ShieldCheck, Database, Network, GitBranch, Eye, AlertTriangle } from "lucide-react";

export default function AuditTrail({ auditTrail }: { auditTrail: string[] }) {
  if (!auditTrail || auditTrail.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
        <Activity className="w-12 h-12 opacity-20" />
        <p className="text-sm text-center px-4">No active query.<br/>The audit trail will appear here when agents start reasoning.</p>
      </div>
    );
  }

  const getStepStyle = (log: string) => {
    if (log.includes("Authenticating") || log.includes("RBAC cleared")) {
      return { Icon: ShieldCheck, color: "text-emerald-400", bg: "border-emerald-500/30" };
    }
    if (log.includes("RBAC BLOCKED")) {
      return { Icon: ShieldCheck, color: "text-red-400", bg: "border-red-500/30" };
    }
    if (log.includes("RouterAgent")) {
      return { Icon: GitBranch, color: "text-violet-400", bg: "border-violet-500/30" };
    }
    if (log.includes("QueryAgent")) {
      return { Icon: Database, color: "text-blue-400", bg: "border-blue-500/30" };
    }
    if (log.includes("NetworkAgent")) {
      return { Icon: Network, color: "text-cyan-400", bg: "border-cyan-500/30" };
    }
    if (log.includes("SynthesisAgent")) {
      return { Icon: Eye, color: "text-amber-400", bg: "border-amber-500/30" };
    }
    if (log.includes("SkepticAgent") && log.includes("flagged")) {
      return { Icon: AlertTriangle, color: "text-orange-400", bg: "border-orange-500/30" };
    }
    if (log.includes("SkepticAgent")) {
      return { Icon: ShieldCheck, color: "text-emerald-400", bg: "border-emerald-500/30" };
    }
    return { Icon: Activity, color: "text-slate-400", bg: "border-slate-700/50" };
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-4">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <h2 className="font-semibold text-slate-200">System Audit Trail</h2>
      </div>

      <div className="relative border-l border-slate-700 ml-3 space-y-5">
        {auditTrail.map((log, idx) => {
          const { Icon, color, bg } = getStepStyle(log);
          return (
            <div key={idx} className="relative pl-6">
              <span className={`absolute -left-3.5 top-1 bg-slate-900 border rounded-full p-1 ${color} ${bg}`}>
                <Icon className="w-3 h-3" />
              </span>
              <div className={`rounded-lg p-3 text-sm text-slate-300 border shadow-sm bg-slate-800/50 ${bg}`}>
                {log}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
