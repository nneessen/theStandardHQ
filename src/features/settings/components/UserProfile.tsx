// src/features/settings/components/UserProfile.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useState, useEffect, useRef } from "react";
import { Link as RouterLink } from "@tanstack/react-router";
import {
  User,
  Save,
  AlertCircle,
  CheckCircle2,
  Users,
  Link2,
  Copy,
  Check,
  Mail,
  Loader2,
  Sparkles,
  Camera,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../../contexts/AuthContext";
import { useUpdateUserProfile } from "../../../hooks/settings/useUpdateUserProfile";
import { useUpdateAgentHierarchy } from "../../../hooks/hierarchy/useUpdateAgentHierarchy";
// eslint-disable-next-line no-restricted-imports -- Legacy import, needs refactor to use hooks
import { supabase } from "@/services/base/supabase";
// eslint-disable-next-line no-restricted-imports -- Legacy import, needs refactor to use hooks
import { searchUsersForAssignment } from "@/services/users/userSearchService";
import { getDisplayName } from "../../../types/user.types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoleName } from "@/types/permissions.types";
import { CustomDomainManager } from "./custom-domains";
import { BrandingSettings } from "./BrandingSettings";
import { FeatureGate } from "@/components/subscription/FeatureGate";
// eslint-disable-next-line no-restricted-imports
import { MyCarrierContractsCard } from "@/features/contracting/components/MyCarrierContractsCard";
import { toast } from "sonner";

export function UserProfile() {
  const { user, requestEmailChange } = useAuth();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateUserProfile();
  const updateHierarchy = useUpdateAgentHierarchy();

  // Check user roles to determine if they are staff-only (no commission settings needed)
  const { data: userRoleData } = useQuery({
    queryKey: ["profile-user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("roles, is_admin")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as { roles: RoleName[]; is_admin: boolean | null };
    },
    enabled: !!user?.id,
  });

  const hasRole = (role: RoleName) =>
    userRoleData?.roles?.includes(role) || false;

  // Staff-only: has trainer/contracting_manager but NOT agent/admin
  // These users don't need commission settings
  const isStaffOnly =
    (hasRole("trainer" as RoleName) ||
      hasRole("contracting_manager" as RoleName)) &&
    !hasRole("agent" as RoleName) &&
    !hasRole("admin" as RoleName) &&
    !userRoleData?.is_admin;

  const [contractLevel, setContractLevel] = useState<string>("");
  const [uplineEmail, setUplineEmail] = useState<string>("");
  const [currentUplineEmail, setCurrentUplineEmail] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const [uplineError, setUplineError] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUplineSuccess, setShowUplineSuccess] = useState(false);

  // Recruiter slug state
  const [recruiterSlug, setRecruiterSlug] = useState<string>("");
  const [currentSlug, setCurrentSlug] = useState<string>("");
  const [slugError, setSlugError] = useState<string>("");
  const [showSlugSuccess, setShowSlugSuccess] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);

  // Profile photo state
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string>("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Email change state
  type EmailChangeStatus = "idle" | "sending" | "sent" | "error";
  const [emailChangeStatus, setEmailChangeStatus] =
    useState<EmailChangeStatus>("idle");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [emailChangeError, setEmailChangeError] = useState("");

  const handleEmailChangeSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    setEmailChangeError("");

    // Require password re-verification
    if (!emailChangePassword.trim()) {
      setEmailChangeError("Please enter your current password to confirm");
      setEmailChangeStatus("error");
      return;
    }

    setEmailChangeStatus("sending");
    try {
      // Verify password before proceeding.
      // Note: signInWithPassword refreshes the session token but the identity
      // stays the same (same user re-authenticating). This is expected.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: emailChangePassword,
      });
      if (authError) {
        setEmailChangeError("Incorrect password");
        setEmailChangeStatus("error");
        return;
      }

      await requestEmailChange(newEmailInput.trim());
      setEmailChangeStatus("sent");
      setEmailChangePassword("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to send confirmation";
      setEmailChangeError(msg);
      setEmailChangeStatus("error");
      toast.error(msg);
    }
  };

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("File size must be less than 5MB");
      return;
    }

    setPhotoError("");
    setUploadingPhoto(true);

    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/avatar_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("recruiting-assets")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("recruiting-assets")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ profile_photo_url: urlData.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfilePhotoUrl(urlData.publicUrl);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast.success("Profile photo updated");
    } catch (err) {
      console.error("Error uploading photo:", err);
      setPhotoError("Failed to upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  // Load current user profile data on mount
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!user?.id) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("upline_id, recruiter_slug, contract_level, profile_photo_url")
        .eq("id", user.id)
        .single();

      if (profile?.profile_photo_url) {
        setProfilePhotoUrl(profile.profile_photo_url);
      }

      // Load contract level from DB (source of truth)
      if (
        profile?.contract_level !== undefined &&
        profile?.contract_level !== null
      ) {
        setContractLevel(profile.contract_level.toString());
      } else {
        setContractLevel("100"); // Default if not set in DB
      }

      // Load recruiter slug
      if (profile?.recruiter_slug) {
        setCurrentSlug(profile.recruiter_slug);
        setRecruiterSlug(profile.recruiter_slug);
      }

      // Load upline info
      if (profile?.upline_id) {
        const { data: upline } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("id", profile.upline_id)
          .single();

        if (upline?.email) {
          setCurrentUplineEmail(upline.email);
          setUplineEmail(upline.email);
        }
      }
    };

    loadUserInfo();
  }, [user?.id]);

  const validateContractLevel = (value: string): boolean => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setValidationError("Contract level must be a number");
      return false;
    }
    if (num < 80 || num > 145) {
      setValidationError("Contract level must be between 80 and 145");
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleContractLevelChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setContractLevel(value);
    setShowSuccess(false);
    validateContractLevel(value);
  };

  const handleUplineEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUplineEmail(e.target.value);
    setUplineError("");
    setShowUplineSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuccess(false);

    if (!validateContractLevel(contractLevel)) {
      return;
    }

    try {
      await updateProfile.mutateAsync({
        contract_level: parseInt(contractLevel, 10),
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update contract level:", error);
    }
  };

  const handleUplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowUplineSuccess(false);
    setUplineError("");

    if (!user?.id) return;

    // Allow clearing upline by submitting empty email
    if (!uplineEmail.trim()) {
      try {
        await updateHierarchy.mutateAsync({
          agent_id: user.id,
          new_upline_id: null,
        });
        setCurrentUplineEmail("");
        setShowUplineSuccess(true);
        setTimeout(() => setShowUplineSuccess(false), 3000);
        return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
      } catch (error: any) {
        setUplineError(error.message || "Failed to remove upline");
        return;
      }
    }

    // Validate upline email exists using RPC (bypasses RLS safely)
    try {
      const results = await searchUsersForAssignment({
        searchTerm: uplineEmail.trim(),
        approvalStatus: "approved",
        excludeIds: [user.id], // exclude self
        limit: 10,
      });

      // Find exact email match (case-insensitive)
      const upline = results.find(
        (u) => u.email.toLowerCase() === uplineEmail.trim().toLowerCase(),
      );

      if (!upline) {
        setUplineError("No user found with that email address");
        return;
      }

      // Update hierarchy
      await updateHierarchy.mutateAsync({
        agent_id: user.id,
        new_upline_id: upline.id,
      });

      setCurrentUplineEmail(upline.email);
      setShowUplineSuccess(true);
      setTimeout(() => setShowUplineSuccess(false), 3000);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update upline";
      setUplineError(message);
    }
  };

  // Slug validation and handlers
  const validateSlug = (value: string): boolean => {
    if (!value.trim()) {
      setSlugError("Please enter a URL slug");
      return false;
    }
    if (value.length < 3) {
      setSlugError("Slug must be at least 3 characters");
      return false;
    }
    if (value.length > 50) {
      setSlugError("Slug must be 50 characters or less");
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      setSlugError("Only lowercase letters, numbers, and hyphens allowed");
      return false;
    }
    if (value.startsWith("-") || value.endsWith("-")) {
      setSlugError("Slug cannot start or end with a hyphen");
      return false;
    }
    setSlugError("");
    return true;
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setRecruiterSlug(value);
    setShowSlugSuccess(false);
    if (value) validateSlug(value);
  };

  const handleSlugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSlugSuccess(false);
    setSlugError("");

    if (!validateSlug(recruiterSlug)) {
      return;
    }

    try {
      // Check if slug is already taken (use maybeSingle to avoid error on 0 rows)
      const { data: existing, error: checkError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("recruiter_slug", recruiterSlug)
        .neq("id", user?.id || "")
        .maybeSingle();

      if (checkError) {
        console.error("Error checking slug:", checkError);
        setSlugError("Failed to check availability. Please try again.");
        return;
      }

      if (existing) {
        setSlugError("This URL is already taken. Try a different one.");
        return;
      }

      // Update directly via supabase since userService may have issues
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ recruiter_slug: recruiterSlug })
        .eq("id", user?.id || "");

      if (updateError) {
        console.error("Error updating slug:", updateError);
        setSlugError("Failed to save. Please try again.");
        return;
      }

      // Invalidate cache so other components get updated slug
      await queryClient.invalidateQueries({ queryKey: ["recruiter-slug"] });

      setCurrentSlug(recruiterSlug);
      setShowSlugSuccess(true);
      setTimeout(() => setShowSlugSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update recruiter slug:", error);
      setSlugError("Failed to save. Please try again.");
    }
  };

  const handleCopyLink = async () => {
    const url = `https://www.thestandardhq.com/join-${currentSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setSlugCopied(true);
      setTimeout(() => setSlugCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (!user) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Loading user information...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  New Workspace
                </span>
              </div>
              <Badge variant="outline" size="sm">
                7-Day Free Trial
              </Badge>
              <Badge variant="outline" size="sm">
                Pro / Team
              </Badge>
            </div>
            <p className="mt-1 text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
              Licensing/Writing #&apos;s team workspace includes a 7-day free
              trial, then requires Pro or Team.
            </p>
            <p className="mt-1 text-[10px] text-zinc-600 dark:text-zinc-300">
              Use your trial to play around with the workspace, manage your
              entire team&apos;s writing numbers, see which agents have which
              carrier contracts, compare which states agents are licensed in,
              and more. Free plan users can still use the carrier contract
              toggles below in Profile after the trial.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RouterLink to="/billing">
              <Button type="button" size="sm" className="h-7 px-2 text-[10px]">
                View Pro/Team Plans
              </Button>
            </RouterLink>
          </div>
        </div>
      </div>

      {/* Profile Photo Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <Camera className="h-3.5 w-3.5 text-zinc-400" />
          <h3 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
            Profile Photo
          </h3>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border border-zinc-200 dark:border-zinc-700 flex-shrink-0">
              <AvatarImage src={profilePhotoUrl || undefined} />
              <AvatarFallback className="text-[13px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {user.first_name?.[0]}
                {user.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
                className="h-7 px-2 text-[10px] border-zinc-200 dark:border-zinc-700"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="h-3 w-3 mr-1" />
                    {profilePhotoUrl ? "Change Photo" : "Upload Photo"}
                  </>
                )}
              </Button>
              <p className="mt-1 text-[9px] text-zinc-400 dark:text-zinc-500">
                JPG, PNG, or GIF · Max 5MB · Used in Slack leaderboard posts
              </p>
              {photoError && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {photoError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Information Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <User className="h-3.5 w-3.5 text-zinc-400" />
          <h3 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
            User Profile
          </h3>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                Email
              </label>
              <div className="px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 rounded text-[11px] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {user.email}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                Name
              </label>
              <div className="px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 rounded text-[11px] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {user.first_name && user.last_name
                  ? getDisplayName({
                      first_name: user.first_name,
                      last_name: user.last_name,
                      email: user.email || "",
                    })
                  : "Not set"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Email Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <Mail className="h-3.5 w-3.5 text-zinc-400" />
          <h3 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
            Change Email
          </h3>
        </div>
        <div className="p-3">
          {emailChangeStatus === "sent" ? (
            <div className="flex items-start gap-2 text-[11px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Confirmation email sent to your new address. Click the link to
                complete the change. It expires in 24 hours.
              </span>
            </div>
          ) : (
            <form onSubmit={handleEmailChangeSubmit}>
              <div className="max-w-md space-y-2">
                <div>
                  <label
                    htmlFor="newEmail"
                    className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1"
                  >
                    New email address
                  </label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmailInput}
                    onChange={(e) => {
                      setNewEmailInput(e.target.value);
                      setEmailChangeError("");
                    }}
                    placeholder="new@example.com"
                    disabled={emailChangeStatus === "sending"}
                    className="h-7 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="emailChangePassword"
                    className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1"
                  >
                    Current password (required)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="emailChangePassword"
                      type="password"
                      value={emailChangePassword}
                      onChange={(e) => {
                        setEmailChangePassword(e.target.value);
                        setEmailChangeError("");
                      }}
                      placeholder="Enter your password"
                      disabled={emailChangeStatus === "sending"}
                      className="h-7 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                    />
                    <Button
                      type="submit"
                      disabled={
                        emailChangeStatus === "sending" ||
                        !newEmailInput.trim() ||
                        !emailChangePassword.trim()
                      }
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px] border-zinc-200 dark:border-zinc-700 flex-shrink-0"
                    >
                      {emailChangeStatus === "sending" ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Link"
                      )}
                    </Button>
                  </div>
                </div>
                {emailChangeStatus === "error" && emailChangeError && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    {emailChangeError}
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Personal Recruiting Link & Branding Card - Premium Feature */}
      {!isStaffOnly && (
        <FeatureGate feature="custom_branding" promptVariant="card">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
              <Link2 className="h-3.5 w-3.5 text-zinc-400" />
              <h3 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                Personal Recruiting Link
              </h3>
            </div>
            <div className="p-3">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">
                Create your personal recruiting URL to share on social media.
                Prospects who submit through your link will appear in your leads
                queue.
              </p>

              {/* Show current link if set */}
              {currentSlug && (
                <div className="mb-3 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">
                        Your recruiting link:
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono truncate">
                        www.thestandardhq.com/join-{currentSlug}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyLink}
                      className="h-7 px-2 text-[10px] border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex-shrink-0"
                    >
                      {slugCopied ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSlugSubmit}>
                <div className="max-w-md">
                  <label
                    htmlFor="recruiterSlug"
                    className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1"
                  >
                    {currentSlug ? "Change URL Slug" : "Choose Your URL Slug"}
                  </label>
                  <div className="flex gap-2 items-center">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                      /join-
                    </span>
                    <Input
                      id="recruiterSlug"
                      type="text"
                      value={recruiterSlug}
                      onChange={handleSlugChange}
                      placeholder="john-smith"
                      className={`h-7 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 ${
                        slugError ? "border-red-500" : ""
                      }`}
                    />
                    <Button
                      type="submit"
                      disabled={updateProfile.isPending || !!slugError}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px] border-zinc-200 dark:border-zinc-700"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {updateProfile.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                  {slugError && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      {slugError}
                    </div>
                  )}
                  {showSlugSuccess && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Recruiting link saved successfully!
                    </div>
                  )}
                  <p className="mt-1.5 text-[9px] text-zinc-400 dark:text-zinc-500">
                    Use lowercase letters, numbers, and hyphens only. Example:
                    john-smith, jsmith2025
                  </p>
                </div>
              </form>

              {/* Custom Domain Section */}
              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <CustomDomainManager />
              </div>

              {/* Branding Settings Section */}
              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <BrandingSettings />
              </div>
            </div>
          </div>
        </FeatureGate>
      )}

      {/* Team Hierarchy Card - Hidden for staff-only roles */}
      {!isStaffOnly && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <Users className="h-3.5 w-3.5 text-zinc-400" />
            <h3 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
              Team Hierarchy
            </h3>
          </div>
          <div className="p-3">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">
              Specify who your upline is. This determines who earns override
              commissions on your policies.
              {currentUplineEmail && (
                <span className="block mt-1 text-zinc-700 dark:text-zinc-300 font-medium">
                  Current upline: {currentUplineEmail}
                </span>
              )}
            </p>

            <form onSubmit={handleUplineSubmit}>
              <div className="max-w-md">
                <label
                  htmlFor="uplineEmail"
                  className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1"
                >
                  Upline Email (leave blank to remove)
                </label>
                <div className="flex gap-2">
                  <Input
                    id="uplineEmail"
                    type="email"
                    value={uplineEmail}
                    onChange={handleUplineEmailChange}
                    placeholder="upline@example.com"
                    className={`h-7 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 ${
                      uplineError ? "border-red-500" : ""
                    }`}
                  />
                  <Button
                    type="submit"
                    disabled={updateHierarchy.isPending}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px] border-zinc-200 dark:border-zinc-700"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {updateHierarchy.isPending ? "Updating..." : "Update"}
                  </Button>
                </div>
                {uplineError && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    {uplineError}
                  </div>
                )}
                {showUplineSuccess && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Upline updated successfully!
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commission Settings Card - Only show for agents, not staff */}
      {!isStaffOnly && (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                Commission Settings
              </h3>
            </div>
            <div className="p-3">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">
                Your contract level determines your commission rates. This
                setting only affects new commissions and does not change
                existing policies or commission calculations.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="max-w-xs">
                  <label
                    htmlFor="contractLevel"
                    className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1"
                  >
                    Contract Level (80-145)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="contractLevel"
                      type="number"
                      min="80"
                      max="145"
                      value={contractLevel}
                      onChange={handleContractLevelChange}
                      className={`h-7 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 w-24 ${
                        validationError ? "border-red-500" : ""
                      }`}
                    />
                    <Button
                      type="submit"
                      disabled={updateProfile.isPending || !!validationError}
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {updateProfile.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                  {validationError && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      {validationError}
                    </div>
                  )}
                  {showSuccess && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Contract level updated successfully!
                    </div>
                  )}
                  {updateProfile.isError && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      Failed to update contract level
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-[10px]">
                <p className="font-medium text-blue-700 dark:text-blue-300 mb-0.5">
                  About Contract Levels
                </p>
                <p className="text-blue-600 dark:text-blue-400">
                  Your contract level represents your commission tier with
                  insurance carriers. Higher levels typically earn higher
                  commission percentages. When you create new policies or
                  commissions, your current contract level will be used to
                  calculate your earnings from the comp guide.
                </p>
              </div>
            </div>
          </div>

          {/* Carrier Contracts Card */}
          {user?.id && <MyCarrierContractsCard agentId={user.id} />}
        </>
      )}
    </div>
  );
}
