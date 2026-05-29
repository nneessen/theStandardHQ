import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import type { ReactorMode } from "./ArcReactor";

export type { ReactorMode };

interface Props {
  mode: ReactorMode;
  accent: string;
  audioLevel?: number;
  className?: string;
}

// Code-split the three.js scene so the WebGL bundle only loads when the reactor
// actually mounts (the gated command center), not in every user's initial bundle.
const Impl = lazy(() =>
  import("./ArcReactor").then((m) => ({ default: m.ArcReactor })),
);

export function ArcReactor(props: Props) {
  return (
    <Suspense
      fallback={<div className={cn("pointer-events-none", props.className)} />}
    >
      <Impl {...props} />
    </Suspense>
  );
}
