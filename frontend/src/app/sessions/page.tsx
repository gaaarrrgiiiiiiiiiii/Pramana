/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  Shield, ArrowLeft, Clock, User, FileText,
  Search, ChevronDown, MessageCircle, Calendar,
  Eye, Lock, Users, BarChart3, Sparkles
} from "lucide-react";
import Link from "next/link";
import axios from "axios";

interface Session {
  id: number;
  user_id: number;
  title: string;
  started_at: string;
  updated_at: string;
  username: string;
  full_name: string;
  badge_number: string;
  user_role: string;
  district: string;
  message_count: number;
}

interface Message {
  id: number;
  query: string;
  answer_english: string;
  answer_translated: string;
  intent: string;
  confidence: number;
  language: string;
  created_at: string;
}

// Role hierarchy — higher = more access
const ROLE_HIERARCHY: Record<string, number> = {
  "SCRB Analyst": 3,
  "Inspector": 2,
  "Field Officer": 1,
};

const ROLE_COLORS: Record<string, string> = {
  "SCRB Analyst": "bg-[rgba(168,85,247,0.1)] text-[#a855f7] border-[rgba(168,85,247,0.2)]",
  "Inspector": "bg-[rgba(59,130,246,0.1)] text-[#3b82f6] border-[rgba(59,130,246,0.2)]",
  "Field Officer": "bg-[rgba(0,255,136,0.08)] text-[#00ff88] border-[rgba(0,255,136,0.15)]",
};

const INTENT_COLORS: Record<string, string> = {
  factual: "bg-[rgba(59,130,246,0.1)] text-[#3b82f6]",
  trend: "bg-[rgba(168,85,247,0.1)] text-[#a855f7]",
  network: "bg-[rgba(249,115,22,0.1)] text-[#f97316]",
  conversational: "bg-[rgba(74,101,128,0.1)] text-[#4a6580]",
  clarification_needed: "bg-[rgba(234,179,8,0.1)] text-[#eab308]",
  blocked: "bg-[rgba(239,68,68,0.1)] text-red-400",
  "out-of-scope": "bg-[rgba(74,101,128,0.08)] text-[#4a6580]",
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) { window.location.href = "/login"; return; }
    
    const userObj = JSON.parse(userStr);
    setCurrentUser(userObj);

    // RBAC Guard: Only SCRB Analyst / DGP can view all sessions supervisory portal
    if (userObj.role !== "SCRB Analyst" && userObj.role !== "DGP") {
      window.location.href = "/my-history";
      return;
    }

    axios
      .get(`${API_URL}/api/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const data: Session[] = res.data || [];
        setSessions(data);
        if (data.length > 0) setSelectedSessionId(data[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [API_URL]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const token = localStorage.getItem("token");
    setMessagesLoading(true);
    axios
      .get(`${API_URL}/api/sessions/${selectedSessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setMessages(res.data.messages || []);
        setMessagesLoading(false);
      })
      .catch(() => setMessagesLoading(false));
  }, [selectedSessionId, API_URL]);

  const userRole = currentUser?.role || "Field Officer";
  const userRank = ROLE_HIERARCHY[userRole] || 1;

  // Filtered + searched sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchSearch =
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.badge_number.toLowerCase().includes(search.toLowerCase()) ||
        s.district.toLowerCase().includes(search.toLowerCase());
      const matchRole = filterRole === "All" || s.user_role === filterRole;
      return matchSearch && matchRole;
    });
  }, [sessions, search, filterRole]);

  // Access scope description
  const accessDescription = ({
    "SCRB Analyst": "Full access · All officer sessions statewide",
    "Inspector": "Partial access · Your sessions + Field Officers in your district",
    "Field Officer": "Own sessions only",
  } as Record<string, string>)[userRole] || "Limited access";

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-[#050a0e] text-[#e0e7ef] flex flex-col font-sans">
      {/* ── Header ── */}
      <header className="h-16 border-b border-[#152233] bg-[#0a1018]/90 backdrop-blur-xl flex items-center justify-between px-6 shadow-lg z-10 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="p-2 bg-[#0f1923] hover:bg-[#152233] text-[#8ba3be] hover:text-[#00ff88] rounded-xl border border-[#1e3a50] hover:border-[rgba(0,255,136,0.2)] transition-all duration-300 flex items-center space-x-2 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#a855f7] to-[#7c3aed] flex items-center justify-center shadow-lg">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white">Supervisory Audit Portal</h1>
              <p className="text-[10px] text-[#4a6580] uppercase tracking-wider">{accessDescription}</p>
            </div>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center space-x-3 text-xs">
            {/* Role access badge */}
            <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border ${ROLE_COLORS[userRole] || "bg-[#0f1923] text-[#4a6580] border-[#1e3a50]"}`}>
              {userRank === 3 ? <Shield className="w-3.5 h-3.5" /> :
               userRank === 2 ? <Users className="w-3.5 h-3.5" /> :
               <Lock className="w-3.5 h-3.5" />}
              <span className="font-semibold">{userRole}</span>
              <span className="opacity-60">· Clearance L{userRank}</span>
            </div>
            <div className="text-[#4a6580]">
              {currentUser.full_name} ({currentUser.badge_number})
            </div>
          </div>
        )}
      </header>

      {/* ── Stats Bar ── */}
      <div className="bg-[#0a1018] border-b border-[#152233] px-6 py-3 flex items-center space-x-6 text-xs flex-shrink-0">
        <div className="flex items-center space-x-1.5 text-[#4a6580]">
          <BarChart3 className="w-3.5 h-3.5 text-[#3b82f6]" />
          <span>Total Sessions: <span className="text-white font-semibold">{sessions.length}</span></span>
        </div>
        <div className="flex items-center space-x-1.5 text-[#4a6580]">
          <MessageCircle className="w-3.5 h-3.5 text-[#00ff88]" />
          <span>Total Messages: <span className="text-white font-semibold">{sessions.reduce((a, s) => a + (s.message_count || 0), 0)}</span></span>
        </div>
        <div className="flex items-center space-x-1.5 text-[#4a6580]">
          <Users className="w-3.5 h-3.5 text-[#a855f7]" />
          <span>Officers: <span className="text-white font-semibold">{new Set(sessions.map((s) => s.user_id)).size}</span></span>
        </div>
        {filteredSessions.length !== sessions.length && (
          <div className="text-[#eab308]">
            Filtered to {filteredSessions.length} sessions
          </div>
        )}
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* ── Left Panel: Session List ── */}
        <div className="w-[380px] border-r border-[#152233] bg-[#0a1018] flex flex-col shadow-xl flex-shrink-0">
          {/* Search + Filter */}
          <div className="p-3 border-b border-[#152233] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a6580]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, badge, district..."
                className="w-full bg-[#0f1923] border border-[#1e3a50] rounded-xl pl-8 pr-3 py-2 text-xs text-[#e0e7ef] outline-none focus:border-[#00ff88] transition-all duration-300"
              />
            </div>
            {userRank >= 2 && (
              <div className="flex items-center space-x-2">
                <ChevronDown className="w-3.5 h-3.5 text-[#4a6580]" />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="flex-1 bg-[#0f1923] border border-[#1e3a50] rounded-xl px-2 py-1.5 text-xs text-[#e0e7ef] outline-none focus:border-[#00ff88] cursor-pointer"
                >
                  <option value="All">All Roles</option>
                  <option value="SCRB Analyst">SCRB Analyst</option>
                  <option value="Inspector">Inspector</option>
                  <option value="Field Officer">Field Officer</option>
                </select>
              </div>
            )}
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loading ? (
              <div className="p-6 text-center text-xs text-[#4a6580]">
                Loading officer logs...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#4a6580]">
                No sessions match your filters.
              </div>
            ) : (
              filteredSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer ${
                    selectedSessionId === s.id
                      ? "bg-[rgba(0,255,136,0.05)] border-[rgba(0,255,136,0.2)]"
                      : "bg-[#0f1923]/40 border-[#152233] hover:bg-[#0f1923] hover:border-[#1e3a50]"
                  }`}
                >
                  {/* Title + Time */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-medium text-xs text-white leading-snug flex-1 truncate">
                      {s.title}
                    </span>
                    <span className="text-[10px] text-[#4a6580] flex items-center flex-shrink-0">
                      <Clock className="w-3 h-3 mr-0.5" />
                      {new Date(s.updated_at).toLocaleDateString("en-IN")}
                    </span>
                  </div>

                  {/* Officer info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-[11px] text-[#4a6580]">
                      <User className="w-3 h-3 text-[#4a6580]" />
                      <span>{s.full_name}</span>
                      <span className="text-[#1e3a50]">·</span>
                      <span className="text-[#4a6580] font-mono">{s.badge_number}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-lg border ${ROLE_COLORS[s.user_role] || "bg-[#0f1923] text-[#4a6580] border-[#152233]"}`}>
                        {s.user_role}
                      </span>
                      {(s.message_count || 0) > 0 && (
                        <span className="text-[10px] text-[#4a6580] flex items-center">
                          <MessageCircle className="w-3 h-3 mr-0.5" />
                          {s.message_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel: Session Replay ── */}
        <div className="flex-1 bg-[#050a0e] flex flex-col overflow-hidden">
          {selectedSession ? (
            <>
              {/* Session Header */}
              <div className="px-6 py-4 border-b border-[#152233] bg-[#0a1018] flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-white mb-1">
                      {selectedSession.title}
                    </h3>
                    <div className="flex items-center space-x-3 text-xs text-[#4a6580]">
                      <span className="flex items-center space-x-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{selectedSession.full_name} ({selectedSession.badge_number})</span>
                      </span>
                      <span className="text-[#152233]">|</span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Started {formatTime(selectedSession.started_at)}</span>
                      </span>
                      <span className="text-[#152233]">|</span>
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] ${ROLE_COLORS[selectedSession.user_role] || ""}`}>
                        {selectedSession.user_role}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-[#4a6580]">
                    <div className="flex items-center space-x-1 text-[#00ff88]">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="font-semibold">{messages.length} exchanges recorded</span>
                    </div>
                    <div className="text-[#4a6580] text-[10px] mt-0.5">Session #{selectedSession.id} · {selectedSession.district}</div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {messagesLoading ? (
                  <div className="text-center text-[#4a6580] text-sm">Loading session messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-[#4a6580] text-sm text-center mt-10">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    No recorded exchanges in this session yet.
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={m.id} className="space-y-3">
                      {/* Turn number */}
                      <div className="flex items-center space-x-2 text-[10px] text-[#4a6580]">
                        <div className="flex-1 border-t border-[#152233]" />
                        <span>Turn {idx + 1} · {formatTime(m.created_at)}</span>
                        <div className="flex-1 border-t border-[#152233]" />
                      </div>

                      {/* Officer query */}
                      <div className="flex justify-end">
                        <div className="bg-gradient-to-br from-[#00ff88] to-[#00cc6a] text-[#050a0e] rounded-2xl rounded-br-none p-4 max-w-[75%] shadow font-medium">
                          <p className="text-[10px] text-[rgba(5,10,14,0.5)] font-semibold mb-1 uppercase tracking-wide">
                            Officer Query
                          </p>
                          <p className="text-sm">{m.query}</p>
                        </div>
                      </div>

                      {/* Agent answer */}
                      <div className="flex justify-start">
                        <div className="bg-[#0f1923] border border-[#1e3a50] text-[#e0e7ef] rounded-2xl rounded-bl-none p-4 max-w-[80%] shadow space-y-2">
                          <div className="flex items-center justify-between text-[10px] border-b border-[#152233] pb-2">
                            <span className="text-[#00ff88] font-semibold uppercase tracking-wide">
                              Co-Pilot Response
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${INTENT_COLORS[m.intent] || "bg-[#0f1923] text-[#4a6580]"}`}>
                                {m.intent}
                              </span>
                              {m.confidence > 0 && (
                                <span className="text-[#4a6580]">
                                  {Math.round(m.confidence * 100)}% conf
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap text-sm">{m.answer_english}</p>
                          {m.answer_translated && m.language !== "English" && (
                            <div className="pt-2 border-t border-[#152233] text-[#4a6580] text-xs italic">
                              {m.answer_translated}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#4a6580] space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[#0f1923] border border-[#152233] flex items-center justify-center">
                <Eye className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-sm">Select an investigation session to replay officer chat logs.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
