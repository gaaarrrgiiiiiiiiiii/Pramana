"use client";
import React, { useState } from "react";
import { Send, Mic, Loader2 } from "lucide-react";
import axios from "axios";
import { SUPPORTED_LANGUAGES } from "./LanguageSelector";

interface Message {
  role: "user" | "agent";
  text: string;
  translated?: string;
  language?: string;
}

export default function ChatInterface({
  language,
  onQueryComplete,
}: {
  language: string;
  onQueryComplete: (data: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<any[]>([]); // Conversation context
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  const nativeLabel = langMeta?.native ?? language;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    const currentQuery = query;
    setMessages((prev) => [...prev, { role: "user", text: currentQuery }]);
    setIsLoading(true);
    setQuery("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      const res = await axios.post(
        `${API_URL}/api/query`,
        {
          query: currentQuery,
          language: language,
          session_id: sessionId,
          conversation_history: history,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = res.data;
      onQueryComplete(data);

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: data.answer_english,
          translated: data.answer_translated,
          language: data.language,
        },
      ]);

      // Update multi-turn history buffer
      setHistory((prev) => [
        ...prev,
        { query: currentQuery, answer_english: data.answer_english },
      ]);
    } catch (err: any) {
      if (err.response?.status === 401) {
        window.location.href = "/login";
        return;
      }
      const detail = err.response?.data?.detail;
      const errorText = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d.msg || d.type || JSON.stringify(d)).join("; ")
        : typeof detail === "object" && detail !== null
        ? JSON.stringify(detail)
        : "Network Error: Could not reach backend.";

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: errorText,
        },
      ]);
      onQueryComplete(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-20 space-y-2">
            <p>Ask a question about FIRs, cases, or criminal networks.</p>
            <p className="text-xs text-slate-600">
              Context-aware conversation active. Replies translated to{" "}
              <span className="text-emerald-500">{nativeLabel}</span>
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>

              {m.translated && m.language !== "English" && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-xs text-emerald-400 font-medium mb-1">
                    {SUPPORTED_LANGUAGES.find((l) => l.code === m.language)?.native ??
                      m.language}{" "}
                    ✦
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-300">
                    {m.translated}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex items-center space-x-3 rounded-bl-none">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="text-sm text-slate-300 font-medium tracking-wide">
                Agents are investigating with context...
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask follow-ups... (reply in ${nativeLabel})`}
            className="w-full bg-slate-800 text-slate-200 rounded-full pl-5 pr-24 py-3 outline-none border border-slate-700 focus:border-blue-500 transition-colors shadow-inner"
          />
          <div className="absolute right-2 flex items-center space-x-1">
            <button
              type="button"
              className="p-2 text-slate-400 hover:text-emerald-400 transition-colors rounded-full hover:bg-slate-700"
              title="Voice enabled"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
