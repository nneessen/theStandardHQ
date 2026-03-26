import type { ReactNode } from "react";

export function BuilderSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {children}
      </div>
    </section>
  );
}
