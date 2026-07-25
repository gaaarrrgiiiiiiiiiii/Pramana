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
    <div className="flex items-center space-x-2 bg-[#0f1923] border border-[#1e3a50] p-2 rounded-xl">
      <Languages className="w-4 h-4 text-[#00ff88] flex-shrink-0" />
      <select
        value={currentLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="bg-[#0a1018] text-[#e0e7ef] text-xs rounded-lg px-2 py-1 outline-none border border-[#152233] focus:border-[#00ff88] transition-colors cursor-pointer"
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
