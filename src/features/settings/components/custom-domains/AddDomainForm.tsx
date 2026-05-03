// Add Domain Form
// Form to add a new custom domain

import React, { useState } from "react";
import { Loader2, X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCustomDomain } from "@/hooks";
import { DnsInstructions } from "./DnsInstructions";

interface AddDomainFormProps {
  onCancel: () => void;
}

export function AddDomainForm({ onCancel }: AddDomainFormProps) {
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdDomain, setCreatedDomain] = useState<{
    id: string;
    hostname: string;
    verification_token: string;
  } | null>(null);

  const createDomain = useCreateCustomDomain();

  const validateHostname = (value: string): string | null => {
    const normalized = value.toLowerCase().trim();

    if (!normalized) {
      return "Hostname is required";
    }

    if (normalized.length > 253) {
      return "Hostname is too long (max 253 characters)";
    }

    // Must have at least 2 dots (subdomain requirement)
    const dotCount = (normalized.match(/\./g) || []).length;
    if (dotCount < 2) {
      return "Only subdomains are supported (e.g., join.yourdomain.com)";
    }

    // Check for invalid characters
    if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(normalized)) {
      return "Invalid hostname format";
    }

    // Reject our domains
    if (
      normalized.includes("thestandardhq.com") ||
      normalized.includes("vercel.app")
    ) {
      return "Cannot use The Standard or Vercel domains";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateHostname(hostname);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const result = await createDomain.mutateAsync(
        hostname.toLowerCase().trim(),
      );
      setCreatedDomain({
        id: result.domain.id,
        hostname: result.domain.hostname,
        verification_token: result.domain.verification_token,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create domain");
    }
  };

  // Show DNS instructions after successful creation
  if (createdDomain) {
    return (
      <div className="rounded-md border border-v2-ring bg-v2-canvas p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-v2-ink">
              Domain Added: {createdDomain.hostname}
            </span>
          </div>
          <button
            onClick={onCancel}
            className="rounded p-1 text-v2-ink-subtle hover:bg-v2-ring hover:text-v2-ink-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-v2-ink-muted">
          Add the DNS records below, then click "Verify DNS" to continue.
        </p>
        <DnsInstructions
          hostname={createdDomain.hostname}
          verificationToken={createdDomain.verification_token}
        />
        <div className="mt-3">
          <Button size="sm" onClick={onCancel} className="h-7 text-xs">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-v2-ring bg-v2-canvas p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-v2-ink">
          Add Custom Domain
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-v2-ink-subtle hover:bg-v2-ring hover:text-v2-ink-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-1 text-xs text-v2-ink-muted">
        Enter a subdomain you control (e.g., join.yourdomain.com). Apex domains
        are not supported in this version.
      </p>

      <div className="mt-3 flex gap-2">
        <Input
          type="text"
          placeholder="join.yourdomain.com"
          value={hostname}
          onChange={(e) => {
            setHostname(e.target.value);
            setError(null);
          }}
          className="h-8 flex-1 text-sm"
          disabled={createDomain.isPending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={createDomain.isPending || !hostname.trim()}
          className="h-8 text-xs"
        >
          {createDomain.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : null}
          Add
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  );
}
