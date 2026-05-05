import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Palette = "none" | "a" | "b" | "c";

const OPTIONS: Array<{ value: Palette; label: string; sub: string }> = [
  { value: "none", label: "Off", sub: "current" },
  { value: "a", label: "A", sub: "Carbon + Amber" },
  { value: "b", label: "B", sub: "Slate + Indigo" },
  { value: "c", label: "C", sub: "Neutral + Lime" },
];

const ALL_CLASSES = [
  "preview-palette-a",
  "preview-palette-b",
  "preview-palette-c",
];

export const PalettePreviewPicker: React.FC = () => {
  const [active, setActive] = useState<Palette>("none");

  useEffect(() => {
    const body = document.body;
    ALL_CLASSES.forEach((c) => body.classList.remove(c));
    if (active !== "none") {
      body.classList.add(`preview-palette-${active}`);
    }
    return () => {
      ALL_CLASSES.forEach((c) => body.classList.remove(c));
    };
  }, [active]);

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1 rounded-full p-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 shadow-lg">
      <span className="text-[9px] uppercase tracking-[0.18em] px-2 text-zinc-500 dark:text-zinc-400 font-bold">
        Palette
      </span>
      {OPTIONS.map((opt) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setActive(opt.value)}
            title={opt.sub}
            className={cn(
              "h-7 px-2.5 text-[11px] font-semibold rounded-full transition-colors min-w-7 inline-flex items-center justify-center",
              isActive
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
