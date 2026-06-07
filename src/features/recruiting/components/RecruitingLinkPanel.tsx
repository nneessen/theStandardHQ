// Recruiting → Your Page: the agent's personal recruiting link.
// Owns the URL-slug editor + the branded link display (subdomain + classic
// /join- path). Self-contained so it can live on the Recruiting page instead of
// being split into Settings.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  Link2,
  Globe,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { subdomainUrl } from "@/lib/hostname";

export function RecruitingLinkPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentSlug, setCurrentSlug] = useState(user?.recruiter_slug ?? "");
  const [slug, setSlug] = useState(user?.recruiter_slug ?? "");
  const [slugError, setSlugError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<"sub" | "join" | null>(null);

  const validate = (value: string): boolean => {
    if (!value.trim()) return (setSlugError("Please enter a URL slug"), false);
    if (value.length < 3)
      return (setSlugError("Slug must be at least 3 characters"), false);
    if (value.length > 50)
      return (setSlugError("Slug must be 50 characters or less"), false);
    if (!/^[a-z0-9-]+$/.test(value))
      return (
        setSlugError("Only lowercase letters, numbers, and hyphens allowed"),
        false
      );
    if (value.startsWith("-") || value.endsWith("-"))
      return (setSlugError("Slug cannot start or end with a hyphen"), false);
    setSlugError("");
    return true;
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(v);
    setSaved(false);
    if (v) validate(v);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    if (!validate(slug)) return;
    setSaving(true);
    try {
      const { data: existing, error: checkError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("recruiter_slug", slug)
        .neq("id", user?.id || "")
        .maybeSingle();
      if (checkError) {
        setSlugError("Failed to check availability. Please try again.");
        return;
      }
      if (existing) {
        setSlugError("This URL is already taken. Try a different one.");
        return;
      }
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ recruiter_slug: slug })
        .eq("id", user?.id || "");
      if (updateError) {
        setSlugError("Failed to save. Please try again.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["recruiter-slug"] });
      setCurrentSlug(slug);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSlugError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const copy = (value: string, which: "sub" | "join") => {
    navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-v2-ink-muted" />
        <h2 className="text-sm font-medium text-v2-ink">
          Your recruiting link
        </h2>
      </div>
      <p className="mt-1 text-xs text-v2-ink-muted">
        Share this anywhere. Prospects who apply through it land in your leads
        queue. Pick a short slug — it powers both links below.
      </p>

      {/* Live links */}
      {currentSlug && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success/10 p-3">
            <a
              href={subdomainUrl(currentSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-2 font-mono text-sm font-medium text-success hover:underline"
            >
              <Globe className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{currentSlug}.thestandardhq.com</span>
            </a>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copy(subdomainUrl(currentSlug), "sub")}
              className="h-7 flex-shrink-0 border-success/40 px-2 text-[11px] text-success hover:bg-success/15"
            >
              {copied === "sub" ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copied === "sub" ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-v2-ring p-3">
            <span className="min-w-0 truncate font-mono text-xs text-v2-ink-muted">
              www.thestandardhq.com/join-{currentSlug}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                copy(
                  `https://www.thestandardhq.com/join-${currentSlug}`,
                  "join",
                )
              }
              className="h-7 flex-shrink-0 border-v2-ring px-2 text-[11px]"
            >
              {copied === "join" ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copied === "join" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {/* Slug editor */}
      <form onSubmit={onSubmit} className="mt-3 max-w-md">
        <label
          htmlFor="recruiterSlug"
          className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted"
        >
          {currentSlug ? "Change your slug" : "Choose your slug"}
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="recruiterSlug"
            type="text"
            value={slug}
            onChange={onChange}
            placeholder="john-smith"
            className={`h-8 text-xs ${slugError ? "border-destructive" : ""}`}
          />
          <Button
            type="submit"
            disabled={saving || !!slugError}
            size="sm"
            variant="outline"
            className="h-8 px-2 text-[11px]"
          >
            <Save className="mr-1 h-3 w-3" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
        {slugError && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            {slugError}
          </div>
        )}
        {saved && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-success">
            <CheckCircle2 className="h-3 w-3" />
            Saved!
          </div>
        )}
      </form>
    </div>
  );
}
