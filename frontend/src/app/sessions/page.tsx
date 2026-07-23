"use client";
import React, { useEffect, useState } from "react";
import { Shield, ArrowLeft, Clock, User, FileText, ChevronRight } from "lucide-react";
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
}

interface Message {
  id: number;
  query: string;
  answer_english: string;
  answer_translated: string;
  intent: string;
  created_at: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (userStr) setCurrentUser(JSON.parse(userStr));

    if (!token) {
      window.location.href = "/login";
      return;
    }

    axios
      .get(`${API_URL}/api/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setSessions(res.data || []);
        if (res.data.length > 0) {
          setSelectedSessionId(res.data[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching sessions:", err);
        setLoading(false);
      });
  }, [API_URL]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const token = localStorage.getItem("token");

    axios
      .get(`${API_URL}/api/sessions/${selectedSessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setMessages(res.data.messages || []);
      })
      .catch((err) => console.error("Error fetching session detail:", err));
  }, [selectedSessionId, API_URL]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shadow-md z-10">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex items-center space-x-2 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h1 className="font-bold text-lg text-slate-100">Supervisory Audit & History Portal</h1>
          </div>
        </div>

        {currentUser && (
          <div className="text-xs text-slate-400 flex items-center space-x-2">
            <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
              {currentUser.role}
            </span>
            <span>{currentUser.full_name} ({currentUser.badge_number})</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Col: Session List */}
        <div className="w-[380px] border-r border-slate-800 bg-slate-900 flex flex-col shadow-xl">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold text-sm text-slate-200">Investigation Sessions</h2>
            <p className="text-xs text-slate-500">
              {currentUser?.role === "SCRB Analyst"
                ? "Viewing all officer query histories statewide"
                : "Viewing officer query histories in your jurisdiction"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading officer logs...</div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No query sessions found.</div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedSessionId === s.id
                      ? "bg-blue-600/10 border-blue-500/50 text-slate-100"
                      : "bg-slate-800/40 border-slate-800 hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs text-slate-200 truncate max-w-[200px]">
                      {s.title}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(s.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
                    <span className="flex items-center space-x-1">
                      <User className="w-3 h-3 text-slate-500" />
                      <span>{s.full_name}</span>
                    </span>
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                      {s.user_role}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Session Replay */}
        <div className="flex-1 bg-slate-950 flex flex-col p-6 overflow-y-auto">
          {selectedSessionId ? (
            <div className="max-w-3xl mx-auto w-full space-y-4">
              <div className="border-b border-slate-800 pb-4 mb-4">
                <h3 className="font-bold text-lg text-slate-200">
                  {sessions.find((s) => s.id === selectedSessionId)?.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Logged Officer: {sessions.find((s) => s.id === selectedSessionId)?.full_name} (
                  {sessions.find((s) => s.id === selectedSessionId)?.badge_number})
                </p>
              </div>

              {messages.length === 0 ? (
                <div className="text-slate-500 text-sm">No recorded exchanges in this session.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="space-y-3">
                    {/* User Query */}
                    <div className="flex justify-end">
                      <div className="bg-blue-600 text-white rounded-2xl rounded-br-none p-4 max-w-[80%] text-sm shadow">
                        <p className="font-semibold text-xs text-blue-200 mb-1">Officer Query</p>
                        <p>{m.query}</p>
                      </div>
                    </div>

                    {/* Agent Answer */}
                    <div className="flex justify-start">
                      <div className="bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl rounded-bl-none p-4 max-w-[85%] text-sm shadow space-y-2">
                        <div className="flex items-center justify-between text-xs text-emerald-400 border-b border-slate-800 pb-2">
                          <span className="font-semibold">Co-Pilot Response</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                            Intent: {m.intent}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.answer_english}</p>
                        {m.answer_translated && (
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
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <FileText className="w-12 h-12 opacity-20 mb-2" />
              <p className="text-sm">Select an investigation session from the left panel to replay officer chat logs.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
