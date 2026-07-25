"use client";
import React from "react";
import { Shield } from "lucide-react";

interface RoleSelectorProps {
  currentRole: string;
  onRoleChange: (r: string) => void;
}

export default function RoleSelector({ currentRole, onRoleChange }: RoleSelectorProps) {
  const roles = ["Field Officer", "Inspector", "SCRB Analyst"];
  return (
    <div className="flex items-center space-x-2 bg-[#0f1923] border border-[#1e3a50] p-2 rounded-xl">
      <Shield className="w-4 h-4 text-[#00ff88]" />
      <span className="text-xs text-[#8ba3be] font-medium">Access Level:</span>
      <select 
        value={currentRole} 
        onChange={(e) => onRoleChange(e.target.value)}
        className="bg-[#0a1018] text-[#e0e7ef] text-xs rounded-lg px-2 py-1 outline-none border border-[#152233] focus:border-[#00ff88] transition-colors cursor-pointer"
      >
        {roles.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  );
}
