// Full-page, guided custom-domain setup wizard.
// Step rail (Domain → DNS → Verify → Live) + large content area, built for
// non-technical agents: one decision per screen, big copy buttons, and
// registrar-specific click-paths (Bluehost first). Drives the existing
// custom-domain hooks; no manual "verify"/"provision" buttons.

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Copy,
  Globe,
  Loader2,
  AlertCircle,
  PartyPopper,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCustomDomain, useCheckDomainStatus } from "@/hooks";
import { REGISTRAR_GUIDES, fillGuideStep } from "./registrar-guides";

type Step = "domain" | "dns" | "verify" | "live";

const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: "domain", label: "Your domain", hint: "Pick the web address" },
  { id: "dns", label: "Add DNS record", hint: "One copy-paste at your host" },
  { id: "verify", label: "Verify", hint: "We check it automatically" },
  { id: "live", label: "Live", hint: "Ready to share" },
];

interface CreatedDomain {
  id: string;
  hostname: string;
  cnameName: string;
  cnameValue: string;
}

function validateSubdomain(raw: string): string | null {
  const v = raw.toLowerCase().trim();
  if (!v) return "Enter a domain.";
  if (v.length > 253) return "That's too long.";
  if (/\s/.test(v)) return "Domains can't contain spaces.";
  if (v.startsWith("http")) return "Leave off http:// — just the domain.";
  if ((v.match(/\./g) || []).length < 2)
    return "Use a subdomain like join.yourdomain.com (not yourdomain.com).";
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(v))
    return "Only letters, numbers, dots, and hyphens are allowed.";
  if (v.includes("thestandardhq.com"))
    return "You already have a free thestandardhq.com address — this is for your OWN domain.";
  return null;
}

export function CustomDomainSetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("domain");
  const [created, setCreated] = useState<CreatedDomain | null>(null);

  const goBackToSettings = useCallback(() => {
    navigate({ to: "/settings", search: { tab: "agents" } });
  }, [navigate]);

  const currentIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="dark theme-v2 v2-canvas font-display text-v2-ink min-h-screen">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-v2-ring px-4 py-3 sm:px-6">
        <button
          onClick={goBackToSettings}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-v2-ink-muted hover:bg-v2-ring hover:text-v2-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Settings
        </button>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-v2-ink-muted" />
          <h1 className="text-sm font-semibold">Set up your custom domain</h1>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr] lg:py-12">
        {/* Step rail */}
        <StepRail currentIdx={currentIdx} />

        {/* Content */}
        <main className="min-w-0">
          {step === "domain" && (
            <DomainStep
              onCreated={(d) => {
                setCreated(d);
                setStep("dns");
              }}
              onCancel={goBackToSettings}
            />
          )}
          {step === "dns" && created && (
            <DnsStep
              created={created}
              onBack={() => setStep("domain")}
              onContinue={() => setStep("verify")}
            />
          )}
          {step === "verify" && created && (
            <VerifyStep
              created={created}
              onLive={() => setStep("live")}
              onBackToDns={() => setStep("dns")}
              onLeave={goBackToSettings}
            />
          )}
          {step === "live" && created && (
            <LiveStep created={created} onDone={goBackToSettings} />
          )}
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────── Step rail ─────────────────────────── */

function StepRail({ currentIdx }: { currentIdx: number }) {
  return (
    <aside className="lg:sticky lg:top-12 lg:self-start">
      <ol className="flex gap-4 lg:flex-col lg:gap-0">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <li key={s.id} className="flex flex-1 items-start gap-3 lg:pb-6">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    done
                      ? "border-success bg-success text-success-foreground"
                      : current
                        ? "border-info bg-info/15 text-info"
                        : "border-v2-ring text-v2-ink-subtle"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mt-1 hidden h-8 w-px lg:block ${done ? "bg-success" : "bg-v2-ring"}`}
                  />
                )}
              </div>
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-sm font-medium ${current ? "text-v2-ink" : done ? "text-v2-ink-muted" : "text-v2-ink-subtle"}`}
                >
                  {s.label}
                </p>
                <p className="hidden text-[11px] text-v2-ink-subtle lg:block">
                  {s.hint}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/* ─────────────────────────── Step 1: domain ─────────────────────── */

function DomainStep({
  onCreated,
  onCancel,
}: {
  onCreated: (d: CreatedDomain) => void;
  onCancel: () => void;
}) {
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createDomain = useCreateCustomDomain();

  const submit = async () => {
    const v = validateSubdomain(hostname);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    try {
      const result = await createDomain.mutateAsync(
        hostname.toLowerCase().trim(),
      );
      const parts = result.domain.hostname.split(".");
      onCreated({
        id: result.domain.id,
        hostname: result.domain.hostname,
        cnameName: parts.slice(0, -2).join("."),
        cnameValue: result.dns_instructions.cname.value,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't add that domain.",
      );
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold">What's your web address?</h2>
      <p className="mt-2 text-sm text-v2-ink-muted">
        Use a <strong>subdomain</strong> of a domain you own — a word in front
        of your domain. Most people use{" "}
        <code className="rounded bg-v2-ring px-1">join</code>.
      </p>

      <div className="mt-6">
        <label className="text-xs font-medium uppercase tracking-wide text-v2-ink-subtle">
          Your custom domain
        </label>
        <Input
          autoFocus
          value={hostname}
          onChange={(e) => {
            setHostname(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="join.youragency.com"
          className="mt-1 h-11 text-base"
        />
        {error ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </p>
        ) : (
          <p className="mt-2 text-xs text-v2-ink-subtle">
            Example: if you own{" "}
            <code className="rounded bg-v2-ring px-1">youragency.com</code>,
            enter{" "}
            <code className="rounded bg-v2-ring px-1">join.youragency.com</code>
            .
          </p>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2">
        <Button
          onClick={submit}
          disabled={createDomain.isPending || !hostname.trim()}
          className="h-10 px-5"
        >
          {createDomain.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Continue
        </Button>
        <Button variant="ghost" onClick={onCancel} className="h-10">
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Step 2: DNS ────────────────────────── */

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-v2-ring bg-v2-canvas px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-subtle">
          {label}
        </p>
        <p className="truncate font-mono text-sm text-v2-ink">{value}</p>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="flex flex-shrink-0 items-center gap-1 rounded border border-v2-ring px-2.5 py-1.5 text-xs font-medium text-v2-ink-muted hover:bg-v2-ring hover:text-v2-ink"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-success" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copy
          </>
        )}
      </button>
    </div>
  );
}

function DnsStep({
  created,
  onBack,
  onContinue,
}: {
  created: CreatedDomain;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [registrarId, setRegistrarId] = useState(REGISTRAR_GUIDES[0].id);
  const guide =
    REGISTRAR_GUIDES.find((g) => g.id === registrarId) ?? REGISTRAR_GUIDES[0];

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold">Add one record at your domain host</h2>
      <p className="mt-2 text-sm text-v2-ink-muted">
        Copy this <strong>CNAME</strong> record into wherever you manage{" "}
        <code className="rounded bg-v2-ring px-1">{created.hostname}</code>.
        It's the only record you need.
      </p>

      {/* The record */}
      <div className="mt-5 space-y-2 rounded-lg border border-v2-ring bg-v2-card p-3">
        <div className="flex items-center justify-between gap-3 rounded-md border border-v2-ring bg-v2-canvas px-3 py-2.5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-subtle">
              Type
            </p>
            <p className="font-mono text-sm text-v2-ink">CNAME</p>
          </div>
        </div>
        <CopyField label="Name / Host" value={created.cnameName} />
        <CopyField label="Value / Points to" value={created.cnameValue} />
      </div>

      {/* Registrar picker */}
      <div className="mt-6">
        <p className="text-sm font-medium">Where is your domain?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REGISTRAR_GUIDES.map((g) => (
            <button
              key={g.id}
              onClick={() => setRegistrarId(g.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                g.id === registrarId
                  ? "border-info bg-info/15 text-info"
                  : "border-v2-ring text-v2-ink-muted hover:bg-v2-ring hover:text-v2-ink"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Selected guide */}
        <div className="mt-4 rounded-lg border border-v2-ring bg-v2-card p-4">
          <p className="text-sm font-semibold">{guide.name} — step by step</p>
          {guide.warning && (
            <div className="mt-2 flex items-start gap-2 rounded bg-warning/10 p-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
              <p className="text-xs text-warning">{guide.warning}</p>
            </div>
          )}
          <ol className="mt-3 space-y-2">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-v2-ink-muted">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-v2-ring text-[10px] font-semibold text-v2-ink">
                  {i + 1}
                </span>
                <span>
                  {fillGuideStep(s, created.cnameName, created.cnameValue)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2">
        <Button onClick={onContinue} className="h-10 px-5">
          I've added the record
        </Button>
        <Button variant="ghost" onClick={onBack} className="h-10">
          Back
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Step 3: verify ─────────────────────── */

function VerifyStep({
  created,
  onLive,
  onBackToDns,
  onLeave,
}: {
  created: CreatedDomain;
  onLive: () => void;
  onBackToDns: () => void;
  onLeave: () => void;
}) {
  const checkStatus = useCheckDomainStatus();
  const [misconfigured, setMisconfigured] = useState<boolean | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const onLiveRef = useRef(onLive);
  onLiveRef.current = onLive;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await checkStatus.mutateAsync(created.id);
        if (cancelled) return;
        setMisconfigured(res.diagnostics?.misconfigured ?? null);
        if (res.status === "active") {
          onLiveRef.current();
          return;
        }
        if (res.status === "error") {
          setLastError(
            res.domain?.last_error ??
              "Something went wrong. Check the record and try again.",
          );
        }
      } catch (err) {
        if (!cancelled) {
          setLastError(
            err instanceof Error ? err.message : "Couldn't check status.",
          );
        }
      }
      if (!cancelled) timer = setTimeout(poll, 12000);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created.id]);

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-info" />
        <h2 className="text-2xl font-bold">Checking your DNS…</h2>
      </div>
      <p className="mt-3 text-sm text-v2-ink-muted">
        We're watching for your CNAME record on{" "}
        <code className="rounded bg-v2-ring px-1">{created.hostname}</code>. DNS
        changes usually take <strong>5–15 minutes</strong> to spread (sometimes
        longer). You can leave this page — it keeps working in the background,
        and you can check status anytime from Settings.
      </p>

      {misconfigured === true && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <div className="text-xs text-warning">
            <p className="font-medium">We can't see the record yet.</p>
            <p className="mt-1">
              Double-check the CNAME <strong>Name</strong> is{" "}
              <code className="rounded bg-warning/20 px-1">
                {created.cnameName}
              </code>{" "}
              and the <strong>Value</strong> is{" "}
              <code className="rounded bg-warning/20 px-1">
                {created.cnameValue}
              </code>
              . On Cloudflare, make sure it's set to "DNS only" (grey cloud).
            </p>
          </div>
        </div>
      )}

      {lastError && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{lastError}</p>
        </div>
      )}

      <div className="mt-8 flex items-center gap-2">
        <Button variant="outline" onClick={onBackToDns} className="h-10">
          Review the record
        </Button>
        <Button variant="ghost" onClick={onLeave} className="h-10">
          I'll check later
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Step 4: live ───────────────────────── */

function LiveStep({
  created,
  onDone,
}: {
  created: CreatedDomain;
  onDone: () => void;
}) {
  const url = `https://${created.hostname}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3">
        <PartyPopper className="h-7 w-7 text-success" />
        <h2 className="text-2xl font-bold">Your domain is live!</h2>
      </div>
      <p className="mt-3 text-sm text-v2-ink-muted">
        Visitors to your custom domain now land on your recruiting page.
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 p-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-2 font-mono text-sm font-medium text-success hover:underline"
        >
          <Globe className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{created.hostname}</span>
        </a>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="flex items-center gap-1 rounded border border-success/40 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/15"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded border border-success/40 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/15"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Visit
          </a>
        </div>
      </div>

      <div className="mt-8">
        <Button onClick={onDone} className="h-10 px-5">
          Done
        </Button>
      </div>
    </div>
  );
}
