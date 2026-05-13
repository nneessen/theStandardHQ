// src/components/layout/RecruitHeader.tsx
// Top header for recruit-facing pages (MyRecruitingPipeline).
// Themed for `.theme-landing` — sits visually above the editorial page
// content. Sharp 2px corners, paper base, deep-green text, Big Shoulders
// Display wordmark, JetBrains Mono for user/system labels, adventure-yellow
// accent baseline.

import { useState, useEffect } from "react";
import { LogOut, Sun, Moon, User } from "lucide-react";
import { useTheme } from "next-themes";

import "@/features/landing/styles/landing-theme.css";

interface RecruitHeaderProps {
  userName: string;
  onLogout: () => void;
}

export function RecruitHeader({ userName, onLogout }: RecruitHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="theme-landing sticky top-0 z-50 surface-paper border-b border-[var(--landing-border)]">
      <div className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 md:h-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span
              className="font-black uppercase tracking-tight"
              style={{
                fontSize: "1.15rem",
                color: "var(--landing-deep-green)",
                fontFamily: "var(--landing-font-display)",
                lineHeight: 1,
              }}
            >
              The Standard
            </span>
            <span
              className="hidden md:inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: "var(--landing-terrain-grey-dark)" }}
            >
              <span
                className="h-px w-5 inline-block"
                style={{ background: "var(--landing-border)" }}
              />
              Onboarding
            </span>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 md:gap-3">
            {/* User name pill */}
            <div
              className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] border font-mono text-[11px]"
              style={{
                borderColor: "var(--landing-border)",
                color: "var(--landing-deep-green)",
              }}
            >
              <User className="h-3 w-3" />
              <span>{userName}</span>
            </div>

            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] border transition-colors hover:bg-[var(--landing-icy-blue-light)]"
                style={{
                  borderColor: "var(--landing-border)",
                  color: "var(--landing-terrain-grey-dark)",
                  background: "transparent",
                }}
                title={
                  resolvedTheme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {/* Logout */}
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] rounded-[2px] border transition-colors hover:opacity-90"
              style={{
                borderColor: "var(--landing-deep-green)",
                background: "var(--landing-deep-green)",
                color: "var(--landing-icy-blue)",
              }}
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Adventure-yellow accent baseline */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: "var(--landing-adventure-yellow)" }}
      />
    </header>
  );
}
