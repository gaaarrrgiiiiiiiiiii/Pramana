"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  Shield, ArrowLeft, Clock, User, FileText,
  Search, ChevronDown, MessageCircle, Calendar,
  Eye, Lock, Users, BarChart3
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
  "SCRB Analyst": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Inspector": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Field Officer": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const INTENT_COLORS: Record<string, string> = {
  factual: "bg-blue-500/20 text-blue-300",
  trend: "bg-purple-500/20 text-purple-300",
  network: "bg-orange-500/20 text-orange-300",
  conversational: "bg-slate-500/20 text-slate-400",
  clarification_needed: "bg-yellow-500/20 text-yellow-300",
  blocked: "bg-red-500/20 text-red-400",
  "out-of-scope": "bg-slate-600/20 text-slate-500",
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
    if (userStr) setCurrentUser(JSON.parse(userStr));
    if (!token) { window.location.href = "/login"; return; }

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
  const accessDescription = {
    "SCRB Analyst": "Full access · All officer sessions statewide",
    "Inspector": "Partial access · Your sessions + Field Officers in your district",
    "Field Officer": "Own sessions only",
  }[userRole] || "Limited access";

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* ── Header ── */}
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shadow-md z-10 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex items-center space-x-2 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="bg-purple-500/20 p-2 rounded-lg border border-purple-500/30">
              <Eye className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-100">Supervisory Audit Portal</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{accessDescription}</p>
            </div>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center space-x-3 text-xs">
            {/* Role access badge */}
            <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border ${ROLE_COLORS[userRole] || "bg-slate-800 text-slate-400 border-slate-700"}`}>
              {userRank === 3 ? <Shield className="w-3.5 h-3.5" /> :
               userRank === 2 ? <Users className="w-3.5 h-3.5" /> :
               <Lock className="w-3.5 h-3.5" />}
              <span className="font-semibold">{userRole}</span>
              <span className="opacity-60">· Clearance L{userRank}</span>
            </div>
            <div className="text-slate-400">
              {currentUser.full_name} ({currentUser.badge_number})
            </div>
          </div>
        )}
      </header>

      {/* ── Stats Bar ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center space-x-6 text-xs flex-shrink-0">
        <div className="flex items-center space-x-1.5 text-slate-400">
          <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
          <span>Total Sessions: <span className="text-slate-200 font-semibold">{sessions.length}</span></span>
        </div>
        <div className="flex items-center space-x-1.5 text-slate-400">
          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>Total Messages: <span className="text-slate-200 font-semibold">{sessions.reduce((a, s) => a + (s.message_count || 0), 0)}</span></span>
        </div>
        <div className="flex items-center space-x-1.5 text-slate-400">
          <Users className="w-3.5 h-3.5 text-purple-400" />
          <span>Officers: <span className="text-slate-200 font-semibold">{new Set(sessions.map((s) => s.user_id)).size}</span></span>
        </div>
        {filteredSessions.length !== sessions.length && (
          <div className="text-yellow-400">
            Filtered to {filteredSessions.length} sessions
          </div>
        )}
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* ── Left Panel: Session List ── */}
        <div className="w-[380px] border-r border-slate-800 bg-slate-900 flex flex-col shadow-xl flex-shrink-0">
          {/* Search + Filter */}
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, badge, district..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {userRank >= 2 && (
              <div className="flex items-center space-x-2">
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
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
              <div className="p-6 text-center text-xs text-slate-500">
                Loading officer logs...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No sessions match your filters.
              </div>
            ) : (
              filteredSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedSessionId === s.id
                      ? "bg-blue-600/10 border-blue-500/50"
                      : "bg-slate-800/40 border-slate-800 hover:bg-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Title + Time */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-medium text-xs text-slate-200 leading-snug flex-1 truncate">
                      {s.title}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center flex-shrink-0">
                      <Clock className="w-3 h-3 mr-0.5" />
                      {new Date(s.updated_at).toLocaleDateString("en-IN")}
                    </span>
                  </div>

                  {/* Officer info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                      <User className="w-3 h-3 text-slate-500" />
                      <span>{s.full_name}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-500 font-mono">{s.badge_number}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ROLE_COLORS[s.user_role] || "bg-slate-700 text-slate-400 border-slate-600"}`}>
                        {s.user_role}
                      </span>
                      {(s.message_count || 0) > 0 && (
                        <span className="text-[10px] text-slate-500 flex items-center">
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
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
          {selectedSession ? (
            <>
              {/* Session Header */}
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-100 mb-1">
                      {selectedSession.title}
                    </h3>
                    <div className="flex items-center space-x-3 text-xs text-slate-400">
                      <span className="flex items-center space-x-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{selectedSession.full_name} ({selectedSession.badge_number})</span>
                      </span>
                      <span className="text-slate-700">|</span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Started {formatTime(selectedSession.started_at)}</span>
                      </span>
                      <span className="text-slate-700">|</span>
                      <span className={`px-2 py-0.5 rounded border text-[10px] ${ROLE_COLORS[selectedSession.user_role] || ""}`}>
                        {selectedSession.user_role}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div className="flex items-center space-x-1 text-emerald-400">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="font-semibold">{messages.length} exchanges recorded</span>
                    </div>
                    <div className="text-slate-600 text-[10px] mt-0.5">Session #{selectedSession.id} · {selectedSession.district}</div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {messagesLoading ? (
                  <div className="text-center text-slate-500 text-sm">Loading session messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-slate-500 text-sm text-center mt-10">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    No recorded exchanges in this session yet.
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={m.id} className="space-y-3">
                      {/* Turn number */}
                      <div className="flex items-center space-x-2 text-[10px] text-slate-600">
                        <div className="flex-1 border-t border-slate-800" />
                        <span>Turn {idx + 1} · {formatTime(m.created_at)}</span>
                        <div className="flex-1 border-t border-slate-800" />
                      </div>

                      {/* Officer query */}
                      <div className="flex justify-end">
                        <div className="bg-blue-600 text-white rounded-2xl rounded-br-none p-4 max-w-[75%] shadow">
                          <p className="text-[10px] text-blue-200 font-semibold mb-1 uppercase tracking-wide">
                            Officer Query
                          </p>
                          <p className="text-sm">{m.query}</p>
                        </div>
                      </div>

                      {/* Agent answer */}
                      <div className="flex justify-start">
                        <div className="bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl rounded-bl-none p-4 max-w-[80%] shadow space-y-2">
                          <div className="flex items-center justify-between text-[10px] border-b border-slate-800 pb-2">
                            <span className="text-emerald-400 font-semibold uppercase tracking-wide">
                              Co-Pilot Response
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${INTENT_COLORS[m.intent] || "bg-slate-700 text-slate-400"}`}>
                                {m.intent}
                              </span>
                              {m.confidence > 0 && (
                                <span className="text-slate-500">
                                  {Math.round(m.confidence * 100)}% conf
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap text-sm">{m.answer_english}</p>
                          {m.answer_translated && m.language !== "English" && (
                            <div className="pt-2 border-t border-slate-800 text-slate-400 text-xs italic">
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
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 space-y-3">
              <Eye className="w-14 h-14 opacity-10" />
              <p className="text-sm">Select an investigation session to replay officer chat logs.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
