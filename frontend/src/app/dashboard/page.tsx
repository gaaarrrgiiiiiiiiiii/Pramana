/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { useState, useRef, useEffect } from "react";
import ChatInterface from "@/components/ChatInterface";
import NetworkGraph from "@/components/NetworkGraph";
import HotspotMap from "@/components/HotspotMap";
import AuditTrail from "@/components/AuditTrail";
import LanguageSelector from "@/components/LanguageSelector";
import { Database, Network, MapPin, Printer, History, LogOut, Shield, Sparkles, Plus, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { PrintableReport } from "@/components/PrintableReport";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";

interface SessionItem {
  id: number;
  title: string;
  updated_at: string;
  message_count: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [language, setLanguage] = useState("Kannada");
  const [activeQueryData, setActiveQueryData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"network" | "hotspots">("network");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const componentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://pramana-api-50044352049.development.catalystappsail.in";

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      router.push("/login");
    } else {
      setUser(JSON.parse(userStr));
    }
  }, [router]);

  // Load session_id from URL query string if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const sId = urlParams.get("session_id");
      if (sId) {
        setActiveSessionId(parseInt(sId, 10));
      }
    }
  }, []);

  // Fetch recent sessions for ChatGPT-style sidebar
  const fetchSessions = () => {
    const token = localStorage.getItem("token") || "";
    axios
      .get(`${API_URL}/api/sessions?token=${token}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        setSessions(res.data || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Auto-switch Investigation Board tab based on AI Query Intent
  useEffect(() => {
    if (!activeQueryData) return;
    if (activeQueryData.intent === "hotspot" || activeQueryData.raw_data?.hotspot_filters) {
      setActiveTab("hotspots");
    } else if (activeQueryData.intent === "network") {
      setActiveTab("network");
    }
    // Refresh sessions list after a query completes
    fetchSessions();
  }, [activeQueryData]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Investigation_Report_${new Date().toISOString().split('T')[0]}`,
  });

  const auditHistoryHref = user?.role === "SCRB Analyst" || user?.role === "DGP" ? "/sessions" : "/my-history";

  if (!user) return null;

  return (
    <div className="h-screen bg-gradient-to-br from-[#080d19] to-[#04070d] text-[#e0e7ef] flex flex-col font-sans overflow-hidden relative">
      {/* Background soft lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.05)_0%,_transparent_70%)] blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,_rgba(0,255,136,0.03)_0%,_transparent_70%)] blur-[100px]" />
      </div>

      {/* Hidden Printable Component */}
      <div className="hidden">
        <PrintableReport ref={componentRef} queryData={activeQueryData} role={user.role} />
      </div>

      {/* Navbar (Soft & Modern) */}
      <header className="h-20 flex items-center justify-between px-8 z-10 relative">
        <Link href="/landing" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
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
            <h1 className="font-bold text-lg tracking-tight text-white">Investigative Co-Pilot</h1>
            <p className="text-[10px] text-[#4a6580] font-medium tracking-wider uppercase">Karnataka Police FIR Analysis</p>
          </div>
        </Link>

        {/* Authenticated User Rank & Actions */}
        <div className="flex items-center space-x-3 relative z-10">
          {activeQueryData && (
            <button
              onClick={() => handlePrint()}
              className="flex items-center space-x-2 bg-[#0f1923] hover:bg-[#152233] text-[#8ba3be] hover:text-[#00ff88] px-3 py-2 rounded-xl text-xs transition-all duration-300 border border-[#1e3a50] hover:border-[rgba(0,255,136,0.2)]"
              title="Export Report to PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          )}

          <Link
            href={auditHistoryHref}
            className="flex items-center space-x-1 bg-[#0f1923] hover:bg-[#152233] text-[#8ba3be] hover:text-[#00ff88] px-3 py-2 rounded-xl text-xs transition-all duration-300 border border-[#1e3a50] hover:border-[rgba(0,255,136,0.2)]"
            title={user.role === "SCRB Analyst" || user.role === "DGP" ? "Supervisory Audit Portal" : "My History & Activity Audit"}
          >
            <History className="w-4 h-4 text-[#3b82f6]" />
            <span>Audit History</span>
          </Link>

          <LanguageSelector currentLanguage={language} onLanguageChange={setLanguage} />

          <button
            onClick={handleLogout}
            className="p-2 bg-[rgba(239,68,68,0.08)] hover:bg-[rgba(239,68,68,0.15)] text-red-400 rounded-xl border border-[rgba(239,68,68,0.15)] hover:border-[rgba(239,68,68,0.3)] transition-all duration-300"
            title="Logout Officer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden p-6 gap-4 pt-2 z-10 relative">
        
        {/* ChatGPT-style Collapsible Session Sidebar */}
        <div className={`transition-all duration-300 flex flex-col bg-[#0f1523]/80 backdrop-blur-2xl border border-[#1e293b]/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-3xl overflow-hidden ${isSidebarOpen ? "w-[200px]" : "w-[50px]"}`}>
          <div className="p-3 border-b border-[#1e293b]/50 flex items-center justify-between">
            {isSidebarOpen && (
              <span className="text-xs font-semibold text-white tracking-wide truncate">Chats</span>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 text-[#4a6580] hover:text-white transition-colors rounded-lg hover:bg-[#152233]"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          <div className="p-2 border-b border-[#1e293b]/30">
            <button
              onClick={() => setActiveSessionId(null)}
              className={`w-full flex items-center space-x-2 text-xs p-2 rounded-xl border transition-all ${
                activeSessionId === null
                  ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30 font-semibold"
                  : "bg-[#0f1923] text-[#8ba3be] border-[#1e3a50] hover:bg-[#152233]"
              }`}
              title="New Chat Session"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              {isSidebarOpen && <span>New Session</span>}
            </button>
          </div>

          {isSidebarOpen && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`p-2 rounded-xl cursor-pointer transition-all border ${
                    activeSessionId === s.id
                      ? "bg-[rgba(0,255,136,0.08)] border-[rgba(0,255,136,0.25)] text-white font-medium"
                      : "bg-[#0f1923]/40 border-transparent hover:bg-[#0f1923] text-[#8ba3be] hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${activeSessionId === s.id ? "text-[#00ff88]" : "text-[#4a6580]"}`} />
                    <span className="truncate flex-1">{s.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Left Col: Chat Interface Panel (Floating Soft Card) */}
        <div className="w-[360px] bg-[#0f1523]/80 backdrop-blur-2xl border border-[#1e293b]/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e293b]/50 bg-[#161d2d]/50 flex items-center justify-between">
            <h2 className="font-semibold text-white tracking-wide">Query Interface</h2>
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            <ChatInterface
              language={language}
              onQueryComplete={setActiveQueryData}
              activeSessionId={activeSessionId}
              onSessionChange={(id) => setActiveSessionId(id)}
            />
          </div>
        </div>

        {/* Center Col: Investigation Board (Network Graph vs Hotspot Map Tabs) */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0f18]/40 backdrop-blur-3xl rounded-3xl border border-[#1e293b]/30 shadow-2xl">
          
          {/* Tab Selection Toolbar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
            <div className="flex items-center space-x-2 px-4 py-2 bg-[#111827]/80 backdrop-blur-xl border border-[#1e293b]/60 rounded-2xl pointer-events-auto shadow-lg">
              <Sparkles className="w-4 h-4 text-[#00ff88] animate-pulse" />
              <h2 className="text-sm font-bold text-white tracking-wide">Investigation Board</h2>
            </div>

            <div className="flex items-center bg-[#111827]/80 backdrop-blur-xl border border-[#1e293b]/60 rounded-2xl p-1 space-x-1 pointer-events-auto shadow-lg">
              <button
                onClick={() => setActiveTab("network")}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer ${
                  activeTab === "network"
                    ? "bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 shadow-[0_0_15px_rgba(0,255,136,0.3)] font-bold"
                    : "text-[#8ba3be] hover:text-white hover:bg-[#1f2937]"
                }`}
              >
                <Network className="w-4 h-4" />
                <span>Criminal Network</span>
              </button>

              <button
                onClick={() => setActiveTab("hotspots")}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer ${
                  activeTab === "hotspots"
                    ? "bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 shadow-[0_0_15px_rgba(0,255,136,0.3)] font-bold"
                    : "text-[#8ba3be] hover:text-white hover:bg-[#1f2937]"
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Crime Hotspots Map</span>
              </button>
            </div>
          </div>

          {/* Dynamic Panel Content */}
          <div className="flex-1 overflow-hidden relative">
            {/* Simulated globe background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-[radial-gradient(circle_at_center,_rgba(0,255,136,0.05)_0%,_transparent_65%)] rounded-full pointer-events-none" />

            {activeTab === "hotspots" ? (
              <HotspotMap initialFilters={activeQueryData?.raw_data?.hotspot_filters} />
            ) : activeQueryData?.intent === "network" ? (
              <NetworkGraph data={activeQueryData.raw_data} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-6 relative z-10">
                <div className="relative z-10 w-24 h-24 rounded-full bg-[#111827]/80 border border-[#00ff88]/30 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,136,0.2)] backdrop-blur-xl">
                  <Database className="w-10 h-10 text-[#00ff88] opacity-90 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-lg text-white font-semibold drop-shadow-md mb-2">
                    {activeQueryData?.intent === "factual"
                      ? "Factual query results shown in chat context."
                      : "No Geospatial Data Loaded"}
                  </p>
                  <p className="text-sm text-[#8ba3be] max-w-sm mx-auto">
                    Awaiting natural language input to generate connections or map crime clusters.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Audit Trail Panel */}
        <div className="w-[320px] bg-[#0f1523]/80 backdrop-blur-2xl border border-[#1e293b]/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e293b]/50 bg-[#161d2d]/50 flex items-center">
            <h2 className="font-semibold text-white tracking-wide">Live Audit Trail</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 relative">
            <AuditTrail auditTrail={activeQueryData?.audit_trail || []} />
          </div>
        </div>
      </main>
    </div>
  );
}
