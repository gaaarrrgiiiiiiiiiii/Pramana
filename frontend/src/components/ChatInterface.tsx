"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Loader2, Plus, MessageSquare, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import axios from "axios";
import { SUPPORTED_LANGUAGES } from "./LanguageSelector";

interface Message {
  role: "user" | "agent";
  text: string;
  translated?: string;
  language?: string;
  messageId?: number;          // DB message id — used for feedback submission
  feedback?: 1 | -1 | null;   // +1 = helpful, -1 = not helpful
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
  const [history, setHistory] = useState<any[]>([]); // Multi-turn context buffer
  const [sessionId, setSessionId] = useState<number | null>(null); // Active DB session id
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  const nativeLabel = langMeta?.native ?? language;

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  // Start a fresh session (clears local chat + unbinds DB session)
  const startNewChat = () => {
    setMessages([]);
    setHistory([]);
    setSessionId(null);
    onQueryComplete(null);
  };

  // Submit 👍/👎 feedback for a specific agent message
  const submitFeedback = async (msgIndex: number, value: 1 | -1) => {
    const msg = messages[msgIndex];
    if (!msg.messageId || msg.feedback !== null) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/api/feedback`,
        { message_id: msg.messageId, feedback: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, feedback: value } : m))
      );
    } catch {
      // Silently ignore feedback errors — non-critical
    }
  };

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
          session_id: sessionId,        // null → backend auto-creates; number → appends to existing
          conversation_history: history,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data;
      onQueryComplete(data);

      // Capture session_id from first response and persist it across turns
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: data.answer_english,
          translated: data.answer_translated,
          language: data.language,
          messageId: data.message_id ?? undefined,
          feedback: null,
        },
      ]);

      // Keep last 5 turns for context window
      setHistory((prev) => [
        ...prev.slice(-4),
        { query: currentQuery, answer_english: data.answer_english },
      ]);
    } catch (err: any) {
      if (err.response?.status === 401) {
        window.location.href = "/login";
        return;
      }
      const detail = err.response?.data?.detail;
      const errorText =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d.type || JSON.stringify(d)).join("; ")
          : typeof detail === "object" && detail !== null
          ? JSON.stringify(detail)
          : "Network Error: Could not reach backend.";

      setMessages((prev) => [...prev, { role: "agent", text: errorText }]);
      onQueryComplete(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a1018]">
      {/* Chat Header — session indicator + New Chat button */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#152233] bg-[#0a1018]/90 backdrop-blur-sm">
        <div className="flex items-center space-x-2 text-xs text-[#4a6580]">
          <MessageSquare className="w-3.5 h-3.5 text-[#00ff88]" />
          {sessionId ? (
            <span className="text-[#4a6580]">
              Session{" "}
              <span className="text-[#00ff88] font-mono font-semibold">
                #{sessionId}
              </span>
              <span className="ml-1.5 text-[#00ff88] animate-pulse">● live</span>
            </span>
          ) : (
            <span className="text-[#4a6580] italic">No active session</span>
          )}
        </div>
        <button
          onClick={startNewChat}
          className="flex items-center space-x-1.5 text-xs bg-[#0f1923] hover:bg-[#152233] text-[#8ba3be] hover:text-[#00ff88] px-2.5 py-1.5 rounded-lg border border-[#1e3a50] hover:border-[rgba(0,255,136,0.2)] transition-all duration-300"
          title="Start a new investigation session"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Message Thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-20 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0f1923] border border-[#152233] flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-[#00ff88] opacity-40" />
            </div>
            <p className="text-[#8ba3be] text-sm">Ask a question about FIRs, cases, or criminal networks.</p>
            <p className="text-xs text-[#4a6580]">
              Context-aware conversation active. Replies translated to{" "}
              <span className="text-[#00ff88]">{nativeLabel}</span>
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                m.role === "user"
                  ? "bg-gradient-to-br from-[#00ff88] to-[#00cc6a] text-[#050a0e] rounded-br-none font-medium"
                  : "bg-[#0f1923] text-[#e0e7ef] border border-[#1e3a50] rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>

              {m.translated && m.language !== "English" && (
                <div className={`mt-3 pt-3 border-t ${m.role === "user" ? "border-[rgba(5,10,14,0.2)]" : "border-[#152233]"}`}>
                  <p className={`text-xs font-medium mb-1 ${m.role === "user" ? "text-[rgba(5,10,14,0.6)]" : "text-[#00ff88]"}`}>
                    {SUPPORTED_LANGUAGES.find((l) => l.code === m.language)
                      ?.native ?? m.language}{" "}
                    ✦
                  </p>
                  <p className={`whitespace-pre-wrap text-sm ${m.role === "user" ? "text-[rgba(5,10,14,0.8)]" : "text-[#8ba3be]"}`}>
                    {m.translated}
                  </p>
                </div>
              )}
            </div>

            {m.role === "agent" && m.messageId && (
              <div className="flex items-center space-x-1 mt-1 ml-1">
                <span className="text-[10px] text-[#4a6580]">Helpful?</span>
                <button
                  onClick={() => submitFeedback(i, 1)}
                  disabled={m.feedback !== null && m.feedback !== undefined}
                  title="Helpful"
                  className={`p-1 rounded transition-colors ${m.feedback === 1 ? "text-[#00ff88]" : "text-[#4a6580] hover:text-[#00ff88] disabled:opacity-40"}`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => submitFeedback(i, -1)}
                  disabled={m.feedback !== null && m.feedback !== undefined}
                  title="Not helpful"
                  className={`p-1 rounded transition-colors ${m.feedback === -1 ? "text-red-400" : "text-[#4a6580] hover:text-red-400 disabled:opacity-40"}`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                {m.feedback !== null && m.feedback !== undefined && (
                  <span className="text-[10px] text-[#4a6580] italic ml-1">recorded</span>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-[#0f1923] rounded-2xl p-4 border border-[#1e3a50] flex items-center space-x-3 rounded-bl-none">
              <Loader2 className="w-5 h-5 animate-spin text-[#00ff88]" />
              <span className="text-sm text-[#8ba3be] font-medium tracking-wide">
                Agents are investigating...
              </span>
            </div>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-[#0a1018] border-t border-[#152233]">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask follow-ups... (reply in ${nativeLabel})`}
            className="w-full bg-[#0f1923] text-[#e0e7ef] rounded-full pl-5 pr-24 py-3 outline-none border border-[#1e3a50] focus:border-[#00ff88] transition-all duration-300 focus:shadow-[0_0_15px_rgba(0,255,136,0.08)] shadow-inner"
          />
          <div className="absolute right-2 flex items-center space-x-1">
            <button
              type="button"
              className="p-2 text-[#4a6580] hover:text-[#00ff88] transition-colors rounded-full hover:bg-[#152233]"
              title="Voice input"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="p-2 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-[#050a0e] rounded-full hover:shadow-[0_0_15px_rgba(0,255,136,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
