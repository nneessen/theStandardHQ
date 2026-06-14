// src/features/recruiting/pages/DesignPreviewPage.tsx
//
// Renders inside the wizard's live-preview iframe. Receives a design spec + a
// preview theme from the parent window via postMessage (same-origin only) and
// renders the REAL shell dispatcher — so what the agent sees is exactly what
// recruits will see, at a true viewport width. The lead form points at the
// sentinel "__preview__" slug, so any test submission is inert.

import { useEffect, useState } from "react";
import { RecruitingPageRenderer } from "../layouts";
import { validateDesignSpec } from "@/lib/recruiting-design-spec";
import { DEFAULT_THEME } from "@/types/recruiting-theme.types";
import type { RecruitingPageTheme } from "@/types/recruiting-theme.types";
import type { RecruitingDesignSpec } from "@/types/recruiting-design-spec.types";
import type { PublicRecruiterInfo } from "@/types/leads.types";

interface PreviewPayload {
  source: "design-preview";
  spec: unknown;
  theme: Partial<RecruitingPageTheme>;
}

const PREVIEW_KEY = "design-preview";

export function DesignPreviewPage() {
  const [spec, setSpec] = useState<RecruitingDesignSpec | null>(null);
  const [theme, setTheme] = useState<RecruitingPageTheme>(DEFAULT_THEME);

  useEffect(() => {
    function apply(payload: {
      spec: unknown;
      theme?: Partial<RecruitingPageTheme>;
    }) {
      setSpec(validateDesignSpec(payload.spec).spec);
      setTheme({ ...DEFAULT_THEME, ...(payload.theme || {}) });
    }

    function onMessage(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as PreviewPayload | undefined;
      if (!data || data.source !== "design-preview") return;
      apply(data);
    }

    window.addEventListener("message", onMessage);

    // First-paint fallback: a snapshot the parent stashes before the iframe is ready.
    try {
      const raw = sessionStorage.getItem(PREVIEW_KEY);
      if (raw) apply(JSON.parse(raw));
    } catch {
      // ignore malformed snapshot
    }

    // Tell the parent we're listening so it re-posts the latest spec.
    window.parent?.postMessage(
      { source: "design-preview-ready" },
      window.location.origin,
    );

    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!spec) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Building preview…
      </div>
    );
  }

  return (
    <RecruitingPageRenderer
      spec={spec}
      theme={theme}
      recruiterInfo={{ is_active: true } as PublicRecruiterInfo}
      recruiterId="__preview__"
      onFormSuccess={() => {}}
    />
  );
}

export default DesignPreviewPage;
