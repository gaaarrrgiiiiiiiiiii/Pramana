"use client";
import React from "react";
import { Languages } from "lucide-react";

export const SUPPORTED_LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "Kannada",   label: "Kannada",   native: "ಕನ್ನಡ" },
  { code: "Hindi",     label: "Hindi",     native: "हिंदी" },
  { code: "Tamil",     label: "Tamil",     native: "தமிழ்" },
  { code: "Telugu",    label: "Telugu",    native: "తెలుగు" },
  { code: "Malayalam", label: "Malayalam", native: "മലയാളം" },
  { code: "Marathi",   label: "Marathi",   native: "मराठी" },
  { code: "Bengali",   label: "Bengali",   native: "বাংলা" },
  { code: "Gujarati",  label: "Gujarati",  native: "ગુજરાતી" },
  { code: "English",   label: "English",   native: "English" },
];

interface LanguageSelectorProps {
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export default function LanguageSelector({ currentLanguage, onLanguageChange }: LanguageSelectorProps) {
  const current = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage);
  return (
    <div className="flex items-center space-x-2 bg-slate-800 p-2 rounded-md">
      <Languages className="w-5 h-5 text-emerald-400 flex-shrink-0" />
      <span className="text-sm text-slate-300 font-medium whitespace-nowrap">Translate:</span>
      <select
        value={currentLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="bg-slate-700 text-white text-sm rounded px-2 py-1 outline-none border border-slate-600 focus:border-emerald-500 transition-colors"
      >
        {SUPPORTED_LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>
            {l.native} — {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
