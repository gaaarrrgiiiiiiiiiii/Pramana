"use client";
import { useState, useRef, useEffect } from "react";
import ChatInterface from "@/components/ChatInterface";
import NetworkGraph from "@/components/NetworkGraph";
import HotspotMap from "@/components/HotspotMap";
import AuditTrail from "@/components/AuditTrail";
import LanguageSelector from "@/components/LanguageSelector";
import { Database, Network, MapPin, Printer, History, LogOut, Shield } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { PrintableReport } from "@/components/PrintableReport";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [language, setLanguage] = useState("Kannada");
  const [activeQueryData, setActiveQueryData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"network" | "hotspots">("network");
  const componentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      router.push("/login");
    } else {
      setUser(JSON.parse(userStr));
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Investigation_Report_${new Date().toISOString().split('T')[0]}`,
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Hidden Printable Component */}
      <div className="hidden">
        <PrintableReport ref={componentRef} queryData={activeQueryData} role={user.role} />
      </div>

      {/* Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
            <Database className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-slate-100">Investigative Co-Pilot</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide">Karnataka Police FIR Analysis</p>
          </div>
        </div>

        {/* Authenticated User Rank & Actions */}
        <div className="flex items-center space-x-3">
          {activeQueryData && (
            <button
              onClick={() => handlePrint()}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-md text-xs transition-colors border border-slate-700 hover:border-slate-600"
              title="Export Report to PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          )}

          <Link
            href="/sessions"
            className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-md text-xs transition-colors border border-slate-700"
            title="Supervisory Chat History"
          >
            <History className="w-4 h-4 text-blue-400" />
            <span>Audit History</span>
          </Link>

          <LanguageSelector currentLanguage={language} onLanguageChange={setLanguage} />

          {/* Authenticated User Badge */}
          <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
            <Shield className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <p className="font-semibold text-slate-200 leading-tight">{user.full_name}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{user.role} · {user.district}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition-colors"
            title="Logout Officer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Col: Chat Interface */}
        <div className="w-[400px] border-r border-slate-800 flex flex-col shadow-xl z-10">
          <ChatInterface language={language} onQueryComplete={setActiveQueryData} />
        </div>

        {/* Center Col: Investigation Board (Network Graph vs Hotspot Map Tabs) */}
        <div className="flex-1 flex flex-col p-6 bg-slate-950 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-slate-950 -z-10"></div>

          {/* Tab Selection Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-200 tracking-wide">Investigation Board</h2>
            </div>

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 space-x-1">
              <button
                onClick={() => setActiveTab("network")}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "network"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Network className="w-4 h-4" />
                <span>Criminal Network</span>
              </button>

              <button
                onClick={() => setActiveTab("hotspots")}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "hotspots"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Crime Hotspots Map</span>
              </button>
            </div>
          </div>

          {/* Dynamic Panel Content */}
          <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl relative">
            {activeTab === "hotspots" ? (
              <HotspotMap />
            ) : activeQueryData?.intent === "network" ? (
              <NetworkGraph data={activeQueryData.raw_data} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                <Network className="w-16 h-16 opacity-20" />
                <p className="text-sm">
                  {activeQueryData?.intent === "factual"
                    ? "Factual query results shown in chat context."
                    : "Ask a network query or click 'Crime Hotspots Map' to visualize."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Audit Trail */}
        <div className="w-[350px] border-l border-slate-800 bg-slate-900/80 p-6 overflow-y-auto shadow-xl z-10">
          <AuditTrail auditTrail={activeQueryData?.audit_trail || []} />
        </div>
      </main>
    </div>
  );
}
