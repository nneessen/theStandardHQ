// DNS Instructions
// Shows the single CNAME record the user must add. Vercel verifies ownership via
// the CNAME and auto-issues SSL once it resolves — no separate TXT record.

import { useState } from "react";
import { Copy, Check, Info } from "lucide-react";

interface DnsInstructionsProps {
  hostname: string;
  vercelCname?: string | null;
}

export function DnsInstructions({
  hostname,
  vercelCname,
}: DnsInstructionsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Extract subdomain prefix (everything before the base domain)
  // e.g., "join.example.com" -> "join", "team.join.example.com" -> "team.join"
  const parts = hostname.split(".");
  const subdomainPrefix = parts.slice(0, -2).join(".");
  const cnameValue = vercelCname || "cname.vercel-dns.com";

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
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );

  return (
    <div className="mt-3 space-y-3 rounded bg-v2-ring p-3">
      <div className="flex items-start gap-2 rounded bg-info/10 p-2">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-info" />
        <p className="text-xs text-info">
          Add this one CNAME record at your domain registrar. Your domain goes
          live automatically once it resolves (usually 5–15 minutes).
        </p>
      </div>

      {/* CNAME Record — the only record needed */}
      <div>
        <h4 className="text-xs font-medium text-v2-ink">CNAME Record</h4>
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
              {cnameValue}
              <CopyButton value={cnameValue} field="cname-value" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
