import type { ReactNode } from "react";

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-[10px] leading-5 text-v2-ink-muted dark:text-v2-ink-subtle">
      {children}
    </p>
  );
}
