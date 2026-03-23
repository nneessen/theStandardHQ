import type { ReactNode } from "react";

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
      {children}
    </p>
  );
}
