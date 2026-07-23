"use client";
import React, { useState } from "react";
import { Shield, Lock, User, AlertCircle, Loader2 } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API_URL}/api/login`, {
        username: username.trim(),
        password: password,
      });

      const { access_token, user } = res.data;
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(user));

      router.push("/");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Authentication failed. Check your badge credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative font-sans text-slate-100">
      {/* Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-slate-950 -z-10"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md">
        {/* Header Badge Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Police Portal Login</h1>
          <p className="text-xs text-slate-400 mt-1">Karnataka State FIR Investigative Co-Pilot</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-3 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Badge ID / Username</label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. officer1, inspector1, admin"
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-slate-200 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Badge Password</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-slate-200 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating Officer...</span>
              </>
            ) : (
              <span>Authenticate & Enter Portal</span>
            )}
          </button>
        </form>

        {/* Demo Accounts Quick-Select */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 text-center">
            Demo Officer Credentials (Click to Autofill)
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => handleQuickLogin("officer1", "pass123")}
              className="p-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-slate-300 text-left transition-colors"
            >
              <div className="font-bold text-slate-200">Field Officer</div>
              <div className="text-[10px] text-slate-500">officer1 / pass123</div>
            </button>
            <button
              onClick={() => handleQuickLogin("inspector1", "pass123")}
              className="p-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-slate-300 text-left transition-colors"
            >
              <div className="font-bold text-slate-200">Inspector</div>
              <div className="text-[10px] text-slate-500">inspector1 / pass123</div>
            </button>
            <button
              onClick={() => handleQuickLogin("admin", "admin123")}
              className="p-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-slate-300 text-left transition-colors"
            >
              <div className="font-bold text-slate-200">DGP / SCRB</div>
              <div className="text-[10px] text-slate-500">admin / admin123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
