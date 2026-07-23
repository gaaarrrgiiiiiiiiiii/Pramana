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
    <div className="flex items-center space-x-2 bg-slate-800 p-2 rounded-md">
      <Shield className="w-5 h-5 text-blue-400" />
      <span className="text-sm text-slate-300 font-medium">Access Level:</span>
      <select 
        value={currentRole} 
        onChange={(e) => onRoleChange(e.target.value)}
        className="bg-slate-700 text-white text-sm rounded px-2 py-1 outline-none border border-slate-600 focus:border-blue-500 transition-colors"
      >
        {roles.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  );
}
