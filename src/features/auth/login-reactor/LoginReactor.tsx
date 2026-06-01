import { lazy, Suspense } from "react";
import { useReducedMotion } from "framer-motion";

// Lazy boundary keeps three.js + the bloom composer out of the login's initial
// bundle; under prefers-reduced-motion (or while the chunk loads) the static
// cyan halo below is the fallback.
const LoginReactorCanvas = lazy(() => import("./LoginReactorCanvas"));

export interface LoginReactorProps {
  className?: string;
}

export function LoginReactor({ className }: LoginReactorProps) {
  const prefersReduced = useReducedMotion();
  return (
    <div className={className} style={{ position: "absolute", inset: 0 }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(70,216,245,0.20), rgba(70,216,245,0) 60%)",
        }}
      />
      {!prefersReduced && (
        <Suspense fallback={null}>
          <LoginReactorCanvas />
        </Suspense>
      )}
    </div>
  );
}
