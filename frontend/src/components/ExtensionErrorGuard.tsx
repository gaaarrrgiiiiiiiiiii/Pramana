"use client";
import { useEffect } from "react";

/**
 * ExtensionErrorGuard catches and suppresses unhandled promise rejections
 * injected into the window context by third-party browser extensions
 * (e.g. MetaMask extension nkbihfbeogaeaoehlefnkodbefgpgknn).
 */
export default function ExtensionErrorGuard() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || "");
      const stack = event.reason?.stack || "";
      
      if (
        reason.includes("MetaMask") ||
        reason.includes("Failed to connect to MetaMask") ||
        stack.includes("chrome-extension://") ||
        stack.includes("nkbihfbeogaeaoehlefnkodbefgpgknn")
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
