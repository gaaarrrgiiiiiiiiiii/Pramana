/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import React, { useState, useEffect } from "react";
import { Shield, Lock, User, AlertCircle, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();



  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError("");

    const API_URL =
      process.env.NEXT_PUBLIC_API_URL ||
      "https://pramana-api-50044352049.development.catalystappsail.in";

    const cleanUsername = username.trim().toLowerCase();

    const formBody = new URLSearchParams();
    formBody.append("username", cleanUsername);
    formBody.append("password", password);

    let access_token = "";
    let user = null;
    let lastError = "";

    // Strategy 1: form-urlencoded direct to backend (simple request = no CORS preflight)
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody.toString(),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        access_token = data.access_token;
        user = data.user;
      } else {
        lastError = data.detail || "Authentication failed.";
      }
    } catch (e1: any) {
      lastError = e1.message || "Network error reaching backend.";
    }

    // Strategy 2: JSON through proxy (works when SSR proxy is deployed)
    if (!access_token) {
      try {
        const res2 = await fetch(`/api/proxy/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: cleanUsername, password }),
        });
        const data2 = await res2.json();
        if (res2.ok && data2.access_token) {
          access_token = data2.access_token;
          user = data2.user;
        } else {
          lastError = data2.detail || lastError;
        }
      } catch {
        // proxy not available in static mode — that's fine, strategy 1 should have worked
      }
    }

    if (access_token && user) {
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dashboard");
    } else {
      const detail = typeof lastError === "string" && lastError
        ? lastError
        : "Authentication failed. Check your badge credentials.";
      setError(detail);
    }

    setLoading(false);
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080d19] to-[#04070d] flex flex-col justify-center items-center p-6 relative font-sans text-[#e0e7ef] overflow-hidden">
      {/* Background Animated Globe & Data Arrow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none opacity-30 z-0 flex items-center justify-center">
        {/* The rotating globe texture */}
        <div className="absolute inset-0 rounded-full globe-texture shadow-[0_0_120px_rgba(59,130,246,0.4)] border border-[#3b82f6]/20" />
        
        {/* Orbit / Trajectory SVG */}
        <svg viewBox="0 0 800 800" className="absolute inset-0 w-full h-full overflow-visible">
          {/* Subtle curved data path */}
          <path id="orbitPath" d="M100,500 Q400,100 700,600" fill="none" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="2" strokeDasharray="4 8" />
          
          {/* Glowing Arrow moving along path */}
          <path d="M-8,-6 L10,0 L-8,6 Z" fill="#06b6d4" filter="drop-shadow(0 0 8px #06b6d4)">
            <animateMotion repeatCount="indefinite" dur="2.5s" rotate="auto" keyPoints="0;1" keyTimes="0;1">
              <mpath href="#orbitPath" />
            </animateMotion>
          </path>
          
          {/* Pulse points at start and end */}
          <circle cx="100" cy="500" r="4" fill="#3b82f6" className="animate-pulse" />
          <circle cx="700" cy="600" r="4" fill="#06b6d4" className="animate-pulse" />
        </svg>
      </div>

      {/* Back to Landing */}
      <Link
        href="/landing"
        className="absolute top-6 left-6 z-20 flex items-center space-x-2 text-[#4a6580] hover:text-[#00ff88] transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </Link>

      <div className="w-full max-w-md relative z-10 animate-slide-up" style={{ opacity: 0, animationDelay: "0.1s" }}>
        {/* Card */}
        <div className="bg-[#0f1523]/80 backdrop-blur-2xl border border-[#1e293b]/50 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1e3a8a] via-[#3b82f6] to-[#06b6d4] flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-[#60a5fa]/30 relative overflow-hidden group mb-4">
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]" />
              <svg viewBox="0 0 24 24" className="w-9 h-9 text-white relative z-10 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(255,255,255,0.1)"/>
                <circle cx="12" cy="11" r="5" />
                <path d="M7 11h10" />
                <ellipse cx="12" cy="11" rx="2" ry="5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Officer Authentication
            </h1>
            <p className="text-xs text-[#8ba3be] mt-1.5 flex items-center space-x-1.5">
              <Sparkles className="w-3 h-3 text-[#3b82f6]" />
              <span>Karnataka State FIR Investigative Co-Pilot</span>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3.5 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-xl flex items-center space-x-3 text-red-400 text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#8ba3be] mb-1.5 uppercase tracking-wider">
                Badge ID / Username
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-[#4a6580] absolute left-4" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. officer1, inspector1, admin"
                  className="w-full bg-[#0a1018]/50 border border-[#1e293b] focus:border-[#3b82f6] text-[#e0e7ef] text-sm rounded-xl pl-11 pr-4 py-3 outline-none transition-all duration-300 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8ba3be] mb-1.5 uppercase tracking-wider">
                Badge Password
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#4a6580] absolute left-4" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0a1018]/50 border border-[#1e293b] focus:border-[#3b82f6] text-[#e0e7ef] text-sm rounded-xl pl-11 pr-4 py-3 outline-none transition-all duration-300 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-[#2563eb] to-[#06b6d4] hover:from-[#3b82f6] hover:to-[#22d3ee] text-white font-bold text-sm rounded-xl shadow-[0_4px_15px_rgba(59,130,246,0.4)] transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 hover:shadow-[0_4px_25px_rgba(59,130,246,0.6)] hover:scale-[1.02] mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Authenticate & Enter Portal</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#1e293b]/50">
            <p className="text-[10px] font-semibold text-[#8ba3be] uppercase tracking-[0.2em] mb-3 text-center">
              Demo Officer Credentials
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { label: "Field Officer", user: "officer1", pass: "pass123" },
                { label: "Inspector", user: "inspector1", pass: "pass123" },
                { label: "DGP / SCRB", user: "admin", pass: "admin123" },
              ].map((cred) => (
                <button
                  key={cred.user}
                  onClick={() => handleQuickLogin(cred.user, cred.pass)}
                  className="p-2.5 bg-[#0a1018]/40 hover:bg-[#1e293b]/60 border border-[#1e293b]/50 hover:border-[#3b82f6]/50 rounded-xl text-left transition-all duration-300 group"
                >
                  <div
                    className="font-bold text-[#e0e7ef] text-[11px] group-hover:text-[#3b82f6] transition-colors"
                  >
                    {cred.label}
                  </div>
                  <div className="text-[10px] text-[#4a6580] mt-0.5">
                    {cred.user} / {cred.pass}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
