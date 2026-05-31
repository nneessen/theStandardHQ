// The Jarvis launcher dock in the lit rail. A cyan-tinted panel housing the
// Twin Shells orb; the whole panel (and ⌘J) opens the Command Center.
// Ported from TheBoard.jsx Rail Jarvis dock. Cyan is reserved for Jarvis/AI.
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { JarvisOrbView } from "@/components/board";

interface SidebarJarvisDockProps {
  isCollapsed: boolean;
  onCloseMobile: () => void;
  isMobile: boolean;
}

export function SidebarJarvisDock({
  isCollapsed,
  onCloseMobile,
  isMobile,
}: SidebarJarvisDockProps) {
  const navigate = useNavigate();

  const open = () => {
    if (isMobile) onCloseMobile();
    navigate({ to: "/command-center" });
  };

  // Global ⌘J / Ctrl+J → Command Center.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        navigate({ to: "/command-center" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Open Jarvis (Command Center)"
        title="Ask Jarvis · ⌘J"
        className="mx-auto mt-2 mb-1 flex h-11 w-11 items-center justify-center rounded-[12px] border border-board-cyan/30 bg-board-cyan/[0.06] shadow-[0_0_18px_rgba(70,216,245,0.12)] transition-colors hover:bg-board-cyan/10"
      >
        <JarvisOrbView size={30} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open Jarvis (Command Center)"
      className="mx-2 mt-2 mb-1 flex items-center gap-3 rounded-[12px] border border-board-cyan/30 bg-gradient-to-b from-board-cyan/[0.08] to-board-cyan/[0.02] px-3 py-2.5 text-left shadow-[0_0_18px_rgba(70,216,245,0.12)] transition-colors hover:border-board-cyan/50"
    >
      <JarvisOrbView size={42} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="font-display text-[16px] font-extrabold tracking-[0.04em] text-board-ink">
            JARVIS
          </span>
          <span className="rounded-[4px] border border-board-cyan/40 px-1.5 py-0.5 font-mono text-[8px] font-bold text-board-cyan">
            AI
          </span>
        </span>
        <span className="mt-0.5 block text-[12px] text-board-cyan/85">
          Ask anything · ⌘J
        </span>
      </span>
    </button>
  );
}
