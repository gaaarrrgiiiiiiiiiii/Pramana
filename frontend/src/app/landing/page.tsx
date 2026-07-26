/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import React, { useEffect, useState } from "react";
import {
  Shield,
  Brain,
  Network,
  MapPin,
  Languages,
  FileText,
  ChevronRight,
  Zap,
  Lock,
  Eye,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const FEATURES = [
  {
    icon: Brain,
    title: "Multi-Agent AI Engine",
    description:
      "Router, Query, Network, Synthesis & Skeptic agents work in concert to deliver verified, auditable answers.",
    color: "#00ff88",
    delay: 0,
  },
  {
    icon: Languages,
    title: "Multi-Lingual Support",
    description:
      "Kannada, Hindi, Tamil, Telugu & 5 more languages — including code-mixed queries officers actually use.",
    color: "#3b82f6",
    delay: 100,
  },
  {
    icon: Network,
    title: "Criminal Network Analysis",
    description:
      "Interactive graph visualization exposing co-accused links, repeat offenders & organized crime clusters.",
    color: "#a855f7",
    delay: 200,
  },
  {
    icon: MapPin,
    title: "Crime Hotspot Mapping",
    description:
      "487,000+ geotagged FIR records on a live map with district, crime type & year filters.",
    color: "#f59e0b",
    delay: 300,
  },
  {
    icon: Lock,
    title: "Role-Based Access Control",
    description:
      "Field Officer, Inspector & SCRB Analyst roles with enforced data boundaries and query restrictions.",
    color: "#ef4444",
    delay: 400,
  },
  {
    icon: FileText,
    title: "Audit Trail & PDF Reports",
    description:
      "Every AI response carries a full reasoning trace. Export official investigation reports instantly.",
    color: "#06b6d4",
    delay: 500,
  },
];

const STATS = [
  { value: "487K+", label: "FIR Records" },
  { value: "6", label: "AI Agents" },
  { value: "9", label: "Languages" },
  { value: "3", label: "Access Roles" },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    // If already logged in, redirect to dashboard
    const token = localStorage.getItem("token");
    if (token) {
      // Don't auto-redirect, let user explore landing
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#050a0e] text-[#e0e7ef] overflow-x-hidden">
      {/* ═══════════════ NAVBAR ═══════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a8a] via-[#3b82f6] to-[#06b6d4] flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-[#60a5fa]/30 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]" />
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white relative z-10 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(255,255,255,0.1)"/>
                <circle cx="12" cy="11" r="5" />
                <path d="M7 11h10" />
                <ellipse cx="12" cy="11" rx="2" ry="5" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">
                Pramana
              </h1>
              <p className="text-[10px] text-[#4a6580] uppercase tracking-widest leading-none">
                Investigative Co-Pilot
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm text-[#8ba3be]">
            <a
              href="#features"
              className="hover:text-[#00ff88] transition-colors duration-300"
            >
              Features
            </a>
            <a
              href="#architecture"
              className="hover:text-[#00ff88] transition-colors duration-300"
            >
              Architecture
            </a>
            <a
              href="#stats"
              className="hover:text-[#00ff88] transition-colors duration-300"
            >
              Data
            </a>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="group flex items-center space-x-2 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-[#050a0e] font-semibold px-5 py-2.5 rounded-xl text-sm hover:shadow-[0_0_25px_rgba(0,255,136,0.3)] transition-all duration-300"
            >
              <span>Enter Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative min-h-screen flex flex-col items-center pt-24 pb-12 overflow-hidden bg-[#050a0e]">
        {/* The Massive Glowing Green Globe Background */}
        <div className="absolute top-[-600px] left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] pointer-events-none">
          {/* Globe Base Sphere */}
          <div className="absolute inset-0 rounded-full bg-[#01140a] shadow-[0_0_200px_rgba(0,255,136,0.15)] overflow-hidden">
            
            {/* Spinning Map/Texture */}
            <div className="absolute inset-0 opacity-40 animate-spin-earth" style={{
              backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0,255,136,0.8) 2px, transparent 2px)",
              backgroundSize: "40px 40px",
            }}></div>

            {/* Globe 3D Shading (Creates the spherical depth illusion over the flat grid) */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_-50px_150px_rgba(0,255,136,0.2),inset_0_0_150px_#050a0e,inset_0_0_50px_#050a0e] bg-[radial-gradient(circle_at_50%_100%,_rgba(0,255,136,0.05)_0%,_#050a0e_75%)]"></div>
          </div>

          {/* Orbital Paths */}
          <div className="absolute top-3/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[30%] rounded-[50%] border border-[rgba(0,255,136,0.3)] transform rotate-6 shadow-[0_0_15px_rgba(0,255,136,0.2)]"></div>
          <div className="absolute top-3/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[40%] rounded-[50%] border border-[rgba(245,158,11,0.2)] transform -rotate-12 shadow-[0_0_15px_rgba(245,158,11,0.1)]"></div>
          
          {/* Glowing dots on orbits */}
          <div className="absolute top-[80%] left-[20%] w-2 h-2 bg-white rounded-full shadow-[0_0_15px_#fff,0_0_30px_#fff] animate-pulse"></div>
          <div className="absolute top-[85%] right-[25%] w-1.5 h-1.5 bg-[#00ff88] rounded-full shadow-[0_0_15px_#00ff88,0_0_30px_#00ff88] animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-[70%] right-[10%] w-2 h-2 bg-[#f59e0b] rounded-full shadow-[0_0_15px_#f59e0b,0_0_30px_#f59e0b] animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Hero Content Overlay */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 flex flex-col items-center text-center mt-[220px]">
          
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-transparent mb-6 animate-slide-down" style={{ animationDelay: "0.1s" }}>
            <MapPin className="w-4 h-4 text-[#8ba3be]" />
            <span className="text-sm font-bold text-[#8ba3be]">
              The AI Co-Pilot trusted by Karnataka Police
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-slide-up text-[#00ff88]" style={{ animationDelay: "0.2s", opacity: 0 }}>
            Investigate Globally<br/>In 1 Click
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-base md:text-lg text-[#8ba3be] mb-10 leading-relaxed animate-slide-up font-medium" style={{ animationDelay: "0.35s", opacity: 0 }}>
            Pramana offers the best of criminal network analysis,<br/>
            fast, efficient and reliable — without the downsides.
          </p>

          {/* White Pill CTA Button */}
          <Link
            href="/login"
            className="group flex items-center justify-between bg-white text-black font-bold pl-6 pr-2 py-2 rounded-full text-lg hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all duration-300 hover:scale-[1.02] animate-slide-up"
            style={{ animationDelay: "0.5s", opacity: 0 }}
          >
            <span className="mr-6 tracking-wide">Enter Portal</span>
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center group-hover:bg-[#222] transition-colors">
              <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Stats Row */}
          <div className="mt-24 flex items-center justify-center space-x-8 md:space-x-16 animate-slide-up" style={{ animationDelay: "0.65s", opacity: 0 }}>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white mb-1">487K+</div>
              <div className="text-xs text-[#8ba3be] font-medium tracking-wide">FIR Records Analyzed</div>
            </div>
            <div className="w-px h-10 bg-gradient-to-b from-transparent via-[#1e3a50] to-transparent"></div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white mb-1">99.8%</div>
              <div className="text-xs text-[#8ba3be] font-medium tracking-wide">Audit Traceability</div>
            </div>
            <div className="w-px h-10 bg-gradient-to-b from-transparent via-[#1e3a50] to-transparent"></div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white mb-1">9</div>
              <div className="text-xs text-[#8ba3be] font-medium tracking-wide">Languages Supported</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURE CARDS (4 around center) ═══════════════ */}
      <section id="features" className="relative py-24 noise">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-16">
            <p className="text-[#00ff88] text-xs font-semibold uppercase tracking-[0.3em] mb-3">
              Capabilities
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Intelligence at Every Layer
            </h2>
            <p className="text-[#8ba3be] max-w-2xl mx-auto">
              Six specialized AI agents, purpose-built for real investigative
              workflows — not generic chatbot wrappers.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="group relative p-6 rounded-2xl border border-[#152233] bg-[#0a1018]/60 backdrop-blur-sm hover:border-[rgba(0,255,136,0.2)] transition-all duration-500 hover:-translate-y-1 overflow-hidden"
                  style={{
                    animationDelay: `${feat.delay}ms`,
                  }}
                >
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                    style={{
                      background: `radial-gradient(circle at 50% 0%, ${feat.color}08 0%, transparent 70%)`,
                    }}
                  />

                  <div className="relative z-10">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 border transition-all duration-300"
                      style={{
                        background: `${feat.color}10`,
                        borderColor: `${feat.color}25`,
                      }}
                    >
                      <Icon
                        className="w-6 h-6"
                        style={{ color: feat.color }}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#00ff88] transition-colors duration-300">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-[#8ba3be] leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ ARCHITECTURE / HOW IT WORKS ═══════════════ */}
      <section id="architecture" className="relative py-24 noise">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[#3b82f6] text-xs font-semibold uppercase tracking-[0.3em] mb-3">
              Architecture
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Multi-Agent Pipeline
            </h2>
            <p className="text-[#8ba3be] max-w-2xl mx-auto">
              Every query flows through a chain of specialized agents — each
              auditable, each traceable, each designed to fail gracefully.
            </p>
          </div>

          {/* Pipeline Steps */}
          <div className="relative">
            {/* Connecting line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(0,255,136,0.2)] to-transparent -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                {
                  step: "01",
                  label: "Router Agent",
                  desc: "Classifies intent",
                  color: "#a855f7",
                },
                {
                  step: "02",
                  label: "Query Agent",
                  desc: "NL → Safe SQL",
                  color: "#3b82f6",
                },
                {
                  step: "03",
                  label: "Network Agent",
                  desc: "Graph traversal",
                  color: "#06b6d4",
                },
                {
                  step: "04",
                  label: "Synthesis Agent",
                  desc: "Merges results",
                  color: "#00ff88",
                },
                {
                  step: "05",
                  label: "Skeptic Agent",
                  desc: "Validates output",
                  color: "#f59e0b",
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="relative z-10 text-center group"
                >
                  <div
                    className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border mb-3 transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: `${s.color}10`,
                      borderColor: `${s.color}30`,
                      boxShadow: `0 0 20px ${s.color}15`,
                    }}
                  >
                    <span
                      className="text-xl font-black"
                      style={{ color: s.color }}
                    >
                      {s.step}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">
                    {s.label}
                  </h4>
                  <p className="text-xs text-[#4a6580]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ STATS SECTION ═══════════════ */}
      <section id="stats" className="relative py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="text-center p-6 rounded-2xl border border-[#152233] bg-[#0a1018]/40 backdrop-blur-sm hover:border-[rgba(0,255,136,0.15)] transition-all duration-300"
              >
                <div className="text-4xl md:text-5xl font-black gradient-text-green mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-[#4a6580] uppercase tracking-wider font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA SECTION ═══════════════ */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,255,136,0.06)_0%,_transparent_60%)]" />
        <div className="relative z-10 max-w-3xl mx-auto text-center px-6">
          <Zap className="w-12 h-12 text-[#00ff88] mx-auto mb-6 animate-pulse-glow" />
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Investigate?
          </h2>
          <p className="text-[#8ba3be] mb-8 text-lg">
            Authenticate with your officer credentials and start querying
            Karnataka&apos;s crime intelligence database.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center space-x-3 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-[#050a0e] font-bold px-10 py-4 rounded-2xl text-lg hover:shadow-[0_0_40px_rgba(0,255,136,0.35)] transition-all duration-300 hover:scale-[1.02]"
          >
            <Shield className="w-6 h-6" />
            <span>Sign In</span>
          </Link>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-[#152233] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-[#4a6580] text-xs">
            <Shield className="w-4 h-4 text-[#00ff88]" />
            <span>
              Pramana — Karnataka Police Investigative Co-Pilot
            </span>
          </div>
          <div className="flex items-center space-x-6 text-xs text-[#4a6580]">
            <span>Confidential — For Authorized Personnel Only</span>
            <Link
              href="/login"
              className="text-[#00ff88] hover:underline"
            >
              Officer Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
