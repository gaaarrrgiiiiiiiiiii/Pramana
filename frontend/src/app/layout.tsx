import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Pramana — Karnataka Police Investigative Co-Pilot",
  description:
    "AI-powered Investigative Co-Pilot for Karnataka Police. Multi-agent natural language crime intelligence, criminal network analysis, and multi-lingual FIR querying.",
  keywords: [
    "Karnataka Police",
    "FIR Analysis",
    "Crime Intelligence",
    "AI Co-Pilot",
    "Criminal Network",
    "Pramana",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#050a0e] text-[#e0e7ef]">
        {children}
      </body>
    </html>
  );
}
