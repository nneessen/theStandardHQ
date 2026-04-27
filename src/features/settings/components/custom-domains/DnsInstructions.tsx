// DNS Instructions
// Shows CNAME and TXT record setup instructions

import React, { useState } from "react";
import { Copy, Check, Info } from "lucide-react";

interface DnsInstructionsProps {
  hostname: string;
  verificationToken: string;
  vercelCname?: string | null;
}

export function DnsInstructions({
  hostname,
  verificationToken,
  vercelCname,
}: DnsInstructionsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Extract subdomain prefix (everything before the base domain)
  // e.g., "join.example.com" -> "join", "team.join.example.com" -> "team.join"
  const parts = hostname.split(".");
  const subdomainPrefix = parts.slice(0, -2).join(".");

  const handleCopy = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ value, field }: { value: string; field: string }) => (
    <button
      onClick={() => handleCopy(value, field)}
      className="ml-2 rounded p-0.5 text-v2-ink-subtle hover:bg-v2-ring hover:text-v2-ink-muted"
      title="Copy"
    >
      {copiedField === field ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );

  return (
    <div className="mt-3 space-y-3 rounded bg-v2-ring p-3">
      <div className="flex items-start gap-2 rounded bg-blue-50 p-2">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
        <p className="text-xs text-blue-700">
          Add these DNS records at your domain registrar. Changes may take 5-15
          minutes to propagate.
        </p>
      </div>

      {/* CNAME Record */}
      <div>
        <h4 className="text-xs font-medium text-v2-ink">1. CNAME Record</h4>
        <p className="mt-0.5 text-xs text-v2-ink-muted">
          Points your subdomain to The Standard
        </p>
        <div className="mt-1 space-y-1 rounded bg-v2-card p-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-v2-ink-muted">Name:</span>
            <span className="flex items-center text-v2-ink">
              {subdomainPrefix}
              <CopyButton value={subdomainPrefix} field="cname-name" />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-v2-ink-muted">Type:</span>
            <span className="text-v2-ink">CNAME</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-v2-ink-muted">Value:</span>
            <span className="flex items-center text-v2-ink">
              {vercelCname || "cname.vercel-dns.com"}
              <CopyButton
                value={vercelCname || "cname.vercel-dns.com"}
                field="cname-value"
              />
            </span>
          </div>
          {!vercelCname && (
            <p className="mt-1 text-xs text-amber-600">
              Note: Check Vercel dashboard for domain-specific CNAME if this
              generic one doesn't work.
            </p>
          )}
        </div>
      </div>

      {/* TXT Verification Record */}
      <div>
        <h4 className="text-xs font-medium text-v2-ink">
          2. TXT Verification Record
        </h4>
        <p className="mt-0.5 text-xs text-v2-ink-muted">
          Proves you own this domain
        </p>
        <div className="mt-1 space-y-1 rounded bg-v2-card p-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-v2-ink-muted">Name:</span>
            <span className="flex items-center text-v2-ink">
              _thestandardhq-verify.{subdomainPrefix}
              <CopyButton
                value={`_thestandardhq-verify.${subdomainPrefix}`}
                field="txt-name"
              />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-v2-ink-muted">Type:</span>
            <span className="text-v2-ink">TXT</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-v2-ink-muted">Value:</span>
            <span className="flex items-center break-all text-v2-ink">
              {verificationToken}
              <CopyButton value={verificationToken} field="txt-value" />
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-v2-ink-subtle">
          Some registrars need the full name:{" "}
          <code className="bg-v2-ring px-1">
            _thestandardhq-verify.{hostname}
          </code>
        </p>
      </div>
    </div>
  );
}
