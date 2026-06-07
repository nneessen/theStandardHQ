// Recruiting → "Your Page" tab.
// One obvious home for everything about an agent's public recruiting page:
// their free branded subdomain link AND custom (white-label) domains. The
// custom-domain "Add domain" CTA opens the full-page setup wizard.

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, Check, Globe, Link2 } from "lucide-react";
import { SectionShell, PillButton } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { useAuth } from "@/contexts/AuthContext";
import { subdomainUrl } from "@/lib/hostname";
import { CustomDomainManager } from "@/features/settings";

export function RecruitingYourPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const slug = user?.recruiter_slug ?? null;

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Header + tab nav */}
          <header className="flex flex-col gap-3">
            <div>
              <Cap>RECRUITING</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Your Page
              </h1>
            </div>
            <div className="flex items-center gap-1.5">
              <Link to="/recruiting">
                <PillButton tone="ghost" size="sm">
                  Pipeline
                </PillButton>
              </Link>
              <PillButton tone="black" size="sm">
                Your Page
              </PillButton>
            </div>
          </header>

          {/* Branded link (free, automatic) */}
          <section className="rounded-lg border border-v2-ring bg-v2-card p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-v2-ink-muted" />
              <h2 className="text-sm font-medium text-v2-ink">
                Your free branded link
              </h2>
            </div>
            <p className="mt-1 text-xs text-v2-ink-muted">
              This works automatically — share it anywhere. It updates if you
              change your URL slug in Settings.
            </p>
            {slug ? (
              <BrandedLinkRow url={subdomainUrl(slug)} />
            ) : (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-dashed border-v2-ring p-3">
                <span className="text-xs text-v2-ink-muted">
                  Choose a URL slug to activate your branded link.
                </span>
                <button
                  onClick={() => navigate({ to: "/settings" })}
                  className="rounded bg-v2-ink px-2.5 py-1 text-xs font-medium text-v2-canvas hover:opacity-90"
                >
                  Set up slug
                </button>
              </div>
            )}
          </section>

          {/* Custom (white-label) domain */}
          <section className="rounded-lg border border-v2-ring bg-v2-card p-4">
            <CustomDomainManager />
          </section>
        </div>
      </div>
    </SectionShell>
  );
}

function BrandedLinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const display = url.replace(/^https?:\/\//, "");
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success/10 p-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-2 font-mono text-sm font-medium text-success hover:underline"
      >
        <Globe className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{display}</span>
      </a>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="flex flex-shrink-0 items-center gap-1 rounded border border-success/40 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/15"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
