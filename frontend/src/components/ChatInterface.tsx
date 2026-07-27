/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Loader2, Plus, MessageSquare, ThumbsUp, ThumbsDown, Sparkles, X, Volume2, Sparkle } from "lucide-react";
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

// Client-side law enforcement phonetic vocabulary smoother
const normalizePoliceJargon = (text: string): string => {
  let norm = text;
  const replacements: [RegExp, string][] = [
    [/\b(fir|f\.i\.r\.|eff i ar|ef i ar)\b/gi, "FIR"],
    [/\b(arms act|arm act|arm's act|arms act 1959)\b/gi, "ARMS ACT 1959"],
    [/\b(cyber crime|cybercrime|cyber climb)\b/gi, "CYBER CRIME"],
    [/\b(adugodi|a 2 go d|adugodi ps)\b/gi, "Adugodi PS"],
    [/\b(kalasipalya|kalasi palya)\b/gi, "Kalasipalya PS"],
    [/\b(banashankari|bana sankari)\b/gi, "Banashankari PS"],
    [/\b(chandrakala|chandra kala|officer chandrakala)\b/gi, "CHANDRAKALA M B"],
    [/\b(gokak|go kak)\b/gi, "Gokak Town PS"],
    [/\b(kr puram|k r puram|k\.r\. puram)\b/gi, "K.R. Puram PS"],
    [/\b(hal ps|h a l ps|h\.a\.l\. ps)\b/gi, "H.A.L. PS"],
    [/\b(bengaluru|bangalore)\b/gi, "Bengaluru City"],
    [/\b(mysuru|mysore)\b/gi, "Mysuru"],
    [/\b(belagavi|belgaum)\b/gi, "Belagavi"],
    [/\b(hubballi|hubli)\b/gi, "Hubballi-Dharwad"],
  ];
  for (const [pattern, replacement] of replacements) {
    norm = norm.replace(pattern, replacement);
  }
  return norm;
};

export default function ChatInterface({
  language,
  onQueryComplete,
  activeSessionId,
  onSessionChange,
}: {
  language: string;
  onQueryComplete: (data: any) => void;
  activeSessionId?: number | null;
  onSessionChange?: (id: number | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(activeSessionId ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  
  // Voice Recording States
  const [isListening, setIsListening] = useState(false);
  const [isAiTranscribing, setIsAiTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // All API calls go through /api/proxy/* (Next.js SSR proxy) to avoid CORS
  const PROXY = "";

  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  const nativeLabel = langMeta?.native ?? language;

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  // Sync state when activeSessionId changes from parent
  useEffect(() => {
    if (activeSessionId === undefined) return;
    setSessionId(activeSessionId);
    if (!activeSessionId) {
      setMessages([]);
      setHistory([]);
      return;
    }

    const token = localStorage.getItem("token") || "";
    setIsSessionLoading(true);
    axios
      .get(`${PROXY}/api/proxy/api/sessions/${activeSessionId}?token=${token}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        const rawMsgs = res.data.messages || [];
        const loadedMsgs: Message[] = [];
        const loadedHistory: any[] = [];

        rawMsgs.forEach((m: any) => {
          loadedMsgs.push({ role: "user", text: m.query });
          loadedMsgs.push({
            role: "agent",
            text: m.answer_english || "",
            translated: m.answer_translated || "",
            language: m.language || "English",
            messageId: m.id,
            feedback: m.feedback,
          });
          loadedHistory.push({ query: m.query, answer_english: m.answer_english });
        });

        setMessages(loadedMsgs);
        setHistory(loadedHistory.slice(-5));
        setIsSessionLoading(false);
      })
      .catch(() => {
        setIsSessionLoading(false);
      });
  }, [activeSessionId]);

  const getSpeechLangCode = (lang: string): string => {
    switch (lang.toLowerCase()) {
      case "kannada": return "kn-IN";
      case "hindi": return "hi-IN";
      case "tamil": return "ta-IN";
      case "telugu": return "te-IN";
      case "marathi": return "mr-IN";
      default: return "en-IN";
    }
  };

  // Process recorded audio blob via Gemini 2.5 Flash Multimodal STT Backend API
  const sendAudioToGeminiBackend = async (audioBlob: Blob) => {
    if (audioBlob.size < 1000) return; // Skip tiny recordings
    setIsAiTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("role", "Field Officer");

      const res = await axios.post(`${PROXY}/api/proxy/voice-query`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.transcription) {
        const highAccuracyText = normalizePoliceJargon(res.data.transcription);
        setQuery(highAccuracyText);
      }
    } catch (err: any) {
      console.warn("Backend Gemini STT note:", err?.response?.data?.detail || err.message);
    } finally {
      setIsAiTranscribing(false);
    }
  };

  // Toggle voice recording with Web Speech + MediaRecorder dual engine
  const toggleVoiceRecording = async () => {
    setVoiceError(null);

    // Stop recording if active
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    // Start recording
    audioChunksRef.current = [];

    // 1. Request microphone stream for MediaRecorder audio capture
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        sendAudioToGeminiBackend(audioBlob);
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err: any) {
      console.warn("MediaRecorder mic access:", err);
    }

    // 2. Start Web Speech API for real-time live typing feedback
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = getSpeechLangCode(language);

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const rawText = finalTranscript || interimTranscript;
          if (rawText) {
            setQuery(normalizePoliceJargon(rawText));
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("WebSpeech API event:", event.error);
          if (event.error === "not-allowed" || event.error === "permission-denied") {
            setVoiceError("Microphone blocked. Click the camera/mic icon in your address bar to allow.");
          }
        };

        recognition.onend = () => {
          // Handled by MediaRecorder stop
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn("WebSpeech fallback error:", err);
      }
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setHistory([]);
    setSessionId(null);
    if (onSessionChange) onSessionChange(null);
    onQueryComplete(null);
  };

  const submitFeedback = async (msgIndex: number, value: 1 | -1) => {
    const msg = messages[msgIndex];
    if (!msg.messageId || msg.feedback !== null) return;
    try {
      const token = localStorage.getItem("token") || "";
      await axios.post(
        `/api/proxy/api/feedback?token=${token}`,
        { message_id: msg.messageId, feedback: value },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, feedback: value } : m))
      );
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
    }

    const currentQuery = query;
    setMessages((prev) => [...prev, { role: "user", text: currentQuery }]);
    setIsLoading(true);
    setQuery("");

    try {
      const token = localStorage.getItem("token") || "";
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL ||
        "https://pramana-api-50044352049.development.catalystappsail.in";

      let data: any = null;

      // Strategy 1: Next.js SSR Proxy POST — no CORS at all (same-origin server-side fetch)
      // This is the primary strategy and most reliable. route.ts has 55s timeout for LLM calls.
      try {
        const proxyRes = await axios.post(
          `/api/proxy/api/query?token=${token}`,
          {
            query: currentQuery,
            language: language,
            session_id: sessionId,
            conversation_history: history,
          },
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            timeout: 50000, // 50s — LLM calls can take 20-30s
          }
        );
        if (proxyRes.data && proxyRes.data.answer_english) {
          data = proxyRes.data;
        } else if (proxyRes.data && proxyRes.data.detail) {
          // Proxy returned an error detail — propagate it
          throw new Error(proxyRes.data.detail);
        }
      } catch (e1: any) {
        // 401 → redirect to login immediately
        if (e1?.response?.status === 401) throw e1;
        console.warn("[query] Strategy 1 proxy failed:", e1?.message || e1);
      }

      // Strategy 2: Direct backend GET with query params — CORS-safe simple request
      // GET is always a simple CORS request (no OPTIONS preflight). Works once GET is deployed.
      if (!data) {
        try {
          const params = new URLSearchParams({
            query: currentQuery,
            language: language,
            token: token,
          });
          if (sessionId) params.append("session_id", String(sessionId));
          if (history.length > 0)
            params.append("conversation_history", JSON.stringify(history));

          const getRes = await fetch(
            `${API_URL}/api/query?${params.toString()}`,
            { method: "GET" }
          );
          if (getRes.ok) {
            const json = await getRes.json();
            if (json && json.answer_english) data = json;
          }
        } catch (e2: any) {
          console.warn("[query] Strategy 2 GET failed:", e2?.message || e2);
        }
      }

      // Strategy 3: Direct POST with JSON — works if browser CORS allows it
      // (Requires ZGS OPTIONS to forward properly — may not work in all environments)
      if (!data) {
        try {
          const postRes = await fetch(
            `${API_URL}/api/query?token=${token}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: currentQuery,
                language: language,
                session_id: sessionId,
                conversation_history: history,
              }),
            }
          );
          if (postRes.ok) {
            const json = await postRes.json();
            if (json && json.answer_english) data = json;
          }
        } catch (e3: any) {
          console.warn("[query] Strategy 3 direct POST failed:", e3?.message || e3);
        }
      }

      if (data && data.answer_english) {
        onQueryComplete(data);

        if (data.session_id && !sessionId) {
          setSessionId(data.session_id);
          if (onSessionChange) onSessionChange(data.session_id);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            text: data.answer_english,
            translated: data.answer_translated || "",
            language: data.language || language,
            messageId: data.message_id ?? undefined,
            feedback: null,
          },
        ]);

        setHistory((prev) => [
          ...prev.slice(-4),
          { query: currentQuery, answer_english: data.answer_english },
        ]);
      } else {
        const errMsg = data?.detail || "Could not retrieve a response. The AI agents are warming up — please try again in a moment.";
        setMessages((prev) => [...prev, { role: "agent", text: errMsg }]);
        onQueryComplete(null);
      }
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
          : err?.message || "Network Error: Could not reach backend server.";

      setMessages((prev) => [...prev, { role: "agent", text: errorText }]);
      onQueryComplete(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a1018]">
      {/* Chat Header */}
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
          className="flex items-center space-x-1.5 text-xs bg-[#0f1923] hover:bg-[#152233] text-[#8ba3be] hover:text-[#00ff88] px-2.5 py-1.5 rounded-lg border border-[#1e3a50] hover:border-[rgba(0,255,136,0.2)] transition-all duration-300 cursor-pointer"
          title="Start a new investigation session"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Message Thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {isSessionLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-[#4a6580] space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#00ff88]" />
            <span>Loading investigation history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center mt-16 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0f1923] border border-[#152233] flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,255,136,0.1)]">
              <Sparkles className="w-8 h-8 text-[#00ff88] opacity-60 animate-pulse" />
            </div>
            <p className="text-[#8ba3be] text-sm font-medium">Ask a question about FIRs, cases, or criminal networks.</p>
            <p className="text-xs text-[#4a6580]">
              Context-aware conversation active. Replies translated to{" "}
              <span className="text-[#00ff88] font-semibold">{nativeLabel}</span>
            </p>
          </div>
        ) : null}

        {!isSessionLoading && messages.map((m, i) => (
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
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>

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

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-[#0a1018] border-t border-[#152233] relative">
        {/* Live Recording HUD Banner */}
        {isListening && (
          <div className="mb-2 bg-red-950/90 border border-red-500/50 rounded-xl px-3 py-2 text-xs text-red-300 flex items-center justify-between animate-pulse shadow-lg">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <Volume2 className="w-4 h-4 text-red-400" />
              <span className="font-semibold">Listening to Voice...</span>
              <span className="text-[11px] text-red-400 font-mono">({nativeLabel})</span>
            </div>
            <button
              type="button"
              onClick={toggleVoiceRecording}
              className="text-[10px] underline hover:text-white font-medium cursor-pointer"
            >
              Done / Refine AI
            </button>
          </div>
        )}

        {/* Gemini AI Transcribing Banner */}
        {isAiTranscribing && (
          <div className="mb-2 bg-[#00ff88]/10 border border-[#00ff88]/40 rounded-xl px-3 py-2 text-xs text-[#00ff88] flex items-center space-x-2 animate-pulse shadow-lg">
            <Sparkle className="w-4 h-4 text-[#00ff88] animate-spin" />
            <span>Refining voice audio with Gemini 2.5 Multimodal AI...</span>
          </div>
        )}

        {/* Voice Error Alert */}
        {voiceError && (
          <div className="mb-2 bg-amber-950/90 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 flex items-center justify-between shadow-lg">
            <span>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="text-amber-400 hover:text-white text-xs font-bold ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isListening
                ? `Listening... speak in ${nativeLabel}`
                : isAiTranscribing
                ? `Gemini AI transcribing audio...`
                : `Ask follow-ups... (reply in ${nativeLabel})`
            }
            className={`w-full bg-[#0f1923] text-[#e0e7ef] rounded-full pl-5 pr-24 py-3 outline-none border transition-all duration-300 focus:shadow-[0_0_15px_rgba(0,255,136,0.08)] shadow-inner text-sm ${
              isListening ? "border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "border-[#1e3a50] focus:border-[#00ff88]"
            }`}
          />
          <div className="absolute right-2 flex items-center space-x-1">
            <button
              type="button"
              onClick={toggleVoiceRecording}
              className={`p-2 rounded-full transition-all duration-300 cursor-pointer ${
                isListening
                  ? "bg-red-500/20 text-red-400 border border-red-500/60 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                  : "text-[#4a6580] hover:text-[#00ff88] hover:bg-[#152233]"
              }`}
              title={isListening ? "Stop voice recording" : "Record voice input"}
            >
              <Mic className="w-5 h-5" />
            </button>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="p-2 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-[#050a0e] rounded-full hover:shadow-[0_0_15px_rgba(0,255,136,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Helper Voice Hint */}
        <p className="text-[10px] text-[#4a6580] mt-1.5 text-center">
          💡 <span className="text-[#8ba3be]">Tip:</span> Try speaking <span className="text-[#00ff88]">&quot;Show criminal network for CYBER CRIME&quot;</span> or <span className="text-[#00ff88]">&quot;Cases investigated by CHANDRAKALA M B&quot;</span>
        </p>
      </div>
    </div>
  );
}
