/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  Shield, ArrowLeft, Clock, User, FileText,
  Search, MessageCircle, Calendar,
  Lock, Activity, ExternalLink
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface ActivityLogItem {
  id: number;
  request_id: string;
  action: string;
  endpoint: string;
  query_text: string;
  intent: string;
  was_blocked: boolean;
  block_reason: string;
  latency_ms: number;
  created_at: string;
}

export default function MyHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<"sessions" | "audit">("sessions");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) { router.push("/login"); return; }
    setCurrentUser(JSON.parse(userStr));

    // Fetch personal sessions
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

    // Fetch personal activity log
    axios
      .get(`${API_URL}/api/audit-log/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setActivityLogs(res.data || []);
      })
      .catch(() => {});
  }, [API_URL, router]);

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

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) =>
      s.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [sessions, search]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const resumeSessionInDashboard = (id: number) => {
    router.push(`/dashboard?session_id=${id}`);
  };

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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00ff88] to-[#00cc6a] flex items-center justify-center shadow-lg text-[#050a0e]">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white">My Investigation History</h1>
              <p className="text-[10px] text-[#4a6580] uppercase tracking-wider">Personal Session Logs & Audit Records</p>
            </div>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border bg-[rgba(0,255,136,0.08)] text-[#00ff88] border-[rgba(0,255,136,0.15)]">
              <Lock className="w-3.5 h-3.5" />
              <span className="font-semibold">{currentUser.role}</span>
              <span className="opacity-60">· {currentUser.district}</span>
            </div>
            <div className="text-[#4a6580]">
              {currentUser.full_name} ({currentUser.badge_number})
            </div>
          </div>
        )}
      </header>

      {/* ── Sub Header / Tabs ── */}
      <div className="bg-[#0a1018] border-b border-[#152233] px-6 py-2.5 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center space-x-2 bg-[#0f1923] p-1 rounded-xl border border-[#152233]">
          <button
            onClick={() => setActiveTab("sessions")}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "sessions"
                ? "bg-[#00ff88] text-[#050a0e] font-semibold shadow"
                : "text-[#8ba3be] hover:text-white"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Investigation Sessions ({sessions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "audit"
                ? "bg-[#3b82f6] text-white font-semibold shadow"
                : "text-[#8ba3be] hover:text-white"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>My Activity Audit Trail ({activityLogs.length})</span>
          </button>
        </div>
      </div>

      <main className="flex-1 flex overflow-hidden">
        {activeTab === "sessions" ? (
          <>
            {/* ── Left Panel: Session List ── */}
            <div className="w-[340px] border-r border-[#152233] bg-[#0a1018] flex flex-col shadow-xl flex-shrink-0">
              <div className="p-3 border-b border-[#152233]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a6580]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search my sessions..."
                    className="w-full bg-[#0f1923] border border-[#1e3a50] rounded-xl pl-8 pr-3 py-2 text-xs text-[#e0e7ef] outline-none focus:border-[#00ff88] transition-all duration-300"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {loading ? (
                  <div className="p-6 text-center text-xs text-[#4a6580]">
                    Loading your sessions...
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#4a6580]">
                    No sessions found.
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
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-xs text-white truncate flex-1">
                          {s.title}
                        </span>
                        <span className="text-[10px] text-[#4a6580] flex items-center flex-shrink-0">
                          <Clock className="w-3 h-3 mr-0.5" />
                          {new Date(s.updated_at).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#4a6580]">
                        <span>Session #{s.id}</span>
                        <span className="flex items-center text-[#00ff88]">
                          <MessageCircle className="w-3 h-3 mr-1" />
                          {s.message_count || 0} messages
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Right Panel: Messages ── */}
            <div className="flex-1 bg-[#050a0e] flex flex-col overflow-hidden">
              {selectedSession ? (
                <>
                  <div className="px-6 py-4 border-b border-[#152233] bg-[#0a1018] flex items-center justify-between flex-shrink-0">
                    <div>
                      <h3 className="font-bold text-base text-white mb-1">
                        {selectedSession.title}
                      </h3>
                      <div className="flex items-center space-x-3 text-xs text-[#4a6580]">
                        <span>Started {formatTime(selectedSession.started_at)}</span>
                        <span>•</span>
                        <span>Session #{selectedSession.id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => resumeSessionInDashboard(selectedSession.id)}
                      className="flex items-center space-x-2 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-[#050a0e] font-semibold px-4 py-2 rounded-xl text-xs shadow hover:shadow-[0_0_15px_rgba(0,255,136,0.3)] transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Resume in Dashboard</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messagesLoading ? (
                      <div className="text-center text-[#4a6580] text-sm">Loading session messages...</div>
                    ) : messages.length === 0 ? (
                      <div className="text-[#4a6580] text-sm text-center mt-10">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        No messages recorded in this session.
                      </div>
                    ) : (
                      messages.map((m, idx) => (
                        <div key={m.id} className="space-y-2">
                          <div className="flex justify-end">
                            <div className="bg-gradient-to-br from-[#00ff88] to-[#00cc6a] text-[#050a0e] rounded-2xl rounded-br-none p-3.5 max-w-[75%] font-medium text-sm">
                              <p className="text-[10px] text-[rgba(5,10,14,0.6)] uppercase mb-1 font-bold">Query #{idx + 1}</p>
                              <p>{m.query}</p>
                            </div>
                          </div>
                          <div className="flex justify-start">
                            <div className="bg-[#0f1923] border border-[#1e3a50] text-[#e0e7ef] rounded-2xl rounded-bl-none p-3.5 max-w-[80%] space-y-2">
                              <p className="text-[10px] text-[#00ff88] uppercase font-bold">Co-Pilot Answer</p>
                              <p className="whitespace-pre-wrap text-sm">{m.answer_english}</p>
                              {m.answer_translated && m.language !== "English" && (
                                <div className="pt-2 border-t border-[#152233] text-[#8ba3be] text-xs">
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
                <div className="flex-1 flex flex-col items-center justify-center text-[#4a6580]">
                  Select a session on the left to review past queries and answers.
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Activity Log Tab ── */
          <div className="flex-1 bg-[#050a0e] p-6 overflow-y-auto">
            <h3 className="font-bold text-base text-white mb-4 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-[#3b82f6]" />
              <span>Personal Activity Audit Trail</span>
            </h3>
            <div className="bg-[#0a1018] border border-[#152233] rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-[#e0e7ef]">
                <thead className="bg-[#0f1923] border-b border-[#152233] text-[#4a6580] uppercase">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Query / Parameters</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#152233]">
                  {activityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-[#4a6580]">
                        No activity records found.
                      </td>
                    </tr>
                  ) : (
                    activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#0f1923]/50 transition-colors">
                        <td className="px-4 py-3 text-[#4a6580] whitespace-nowrap">
                          {formatTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#00ff88]">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 max-w-md truncate text-[#8ba3be]">
                          {log.query_text || log.endpoint}
                        </td>
                        <td className="px-4 py-3">
                          {log.was_blocked ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-red-400 border border-red-800">
                              Blocked: {log.block_reason}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Allowed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#4a6580] font-mono">
                          {log.latency_ms} ms
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
