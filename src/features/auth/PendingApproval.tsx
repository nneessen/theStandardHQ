// src/features/auth/PendingApproval.tsx
// Shows pending users the join request form or their request status

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "@tanstack/react-router";
import {
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  Building2,
  Users,
  Loader2,
  ArrowRight,
  UserPlus,
} from "lucide-react";
import {
  useJoinRequestEligibility,
  useMyPendingJoinRequest,
} from "@/hooks/join-request";
import { JoinRequestForm } from "@/features/settings";
import { useAuth } from "@/contexts/AuthContext";

interface PendingApprovalProps {
  email?: string;
}

export const PendingApproval: React.FC<PendingApprovalProps> = ({ email }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: eligibility, isLoading: eligibilityLoading } =
    useJoinRequestEligibility();
  const {
    data: pendingRequest,
    isLoading: requestLoading,
    refetch,
  } = useMyPendingJoinRequest();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const isLoading = eligibilityLoading || requestLoading;

  return (
    <div className="theme-v2 v2-canvas font-display text-v2-ink min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-foreground relative overflow-hidden">
        {/* Geometric background pattern */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Animated glow orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 -right-20 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-8 xl:p-10 w-full">
          {/* Enhanced logo with glow and subtitle */}
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 rounded-xl blur-xl group-hover:bg-amber-500/30 transition-all duration-500" />
              <img
                src="/logos/Light Letter Logo .png"
                alt="The Standard"
                className="relative h-14 w-14 drop-shadow-2xl dark:hidden"
              />
              <img
                src="/logos/LetterLogo.png"
                alt="The Standard"
                className="relative h-14 w-14 drop-shadow-2xl hidden dark:block"
              />
            </div>
            <div className="flex flex-col">
              <span
                className="text-white dark:text-black text-2xl font-bold tracking-wide"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                THE STANDARD
              </span>
              <span className="text-amber-400 text-[10px] uppercase tracking-[0.3em] font-medium">
                Financial Group
              </span>
            </div>
          </div>

          {/* Middle - Main messaging */}
          <div className="space-y-4">
            <div className="w-7 h-7 rounded bg-white/10 dark:bg-black/10 flex items-center justify-center">
              <UserPlus className="h-3.5 w-3.5 text-white dark:text-black" />
            </div>
            <h1
              className="text-4xl xl:text-5xl font-bold leading-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <span className="text-white dark:text-black">
                Join your team.
              </span>
            </h1>
            <p className="text-white/80 dark:text-black/70 text-sm max-w-md leading-relaxed">
              Request access to your organization and start tracking
              commissions, managing recruits, and growing your business.
            </p>
          </div>

          {/* Bottom */}
          <div className="text-white/50 dark:text-black/50 text-xs">
            © {new Date().getFullYear()} The Standard Financial Group
          </div>
        </div>
      </div>

      {/* Right Panel - Content */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-6">
            <div className="flex items-center gap-3">
              <img
                src="/logos/LetterLogo.png"
                alt="The Standard"
                className="h-10 w-10 dark:hidden"
              />
              <img
                src="/logos/Light Letter Logo .png"
                alt="The Standard"
                className="h-10 w-10 hidden dark:block"
              />
              <div className="flex flex-col">
                <span
                  className="text-foreground text-xl font-bold tracking-wide"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  THE STANDARD
                </span>
                <span className="text-amber-500 text-[9px] uppercase tracking-[0.25em] font-medium">
                  Financial Group
                </span>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="mb-3">
            <h2
              className="text-lg font-bold text-foreground mb-1"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Complete Your Setup
            </h2>
            {email && (
              <p className="text-xs text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">{email}</span>
              </p>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <Card className="border-muted">
              <CardContent className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          )}

          {/* Has Pending Request - Show Status */}
          {!isLoading && pendingRequest && (
            <Card className="border-muted">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Request Pending
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    Awaiting Approval
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Your request to join has been submitted
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* IMO */}
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">IMO:</span>
                  <span className="font-medium">
                    {pendingRequest.imo?.name || "Unknown"}
                  </span>
                </div>

                {/* Agency */}
                {pendingRequest.agency && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Agency:</span>
                    <span className="font-medium">
                      {pendingRequest.agency.name}
                    </span>
                  </div>
                )}

                {/* Message */}
                {pendingRequest.message && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    "{pendingRequest.message}"
                  </div>
                )}

                <Separator />

                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      An administrator will review your request shortly
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You'll get access once approved. Check back later or wait
                    for notification.
                  </p>
                </div>

                <div className="text-xs text-muted-foreground text-center">
                  Submitted:{" "}
                  {new Date(pendingRequest.requested_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Has Rejected Request */}
          {!isLoading &&
            !pendingRequest &&
            !eligibility?.canSubmit &&
            eligibility?.reason?.includes("rejected") && (
              <Card className="border-destructive/30">
                <CardContent className="py-6 text-center space-y-3">
                  <XCircle className="h-10 w-10 text-destructive mx-auto" />
                  <div>
                    <p className="font-medium text-destructive">
                      Request Rejected
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your previous request was not approved. Contact support
                      for assistance.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Can Submit Request - Show Form */}
          {!isLoading && eligibility?.canSubmit && (
            <>
              <Card className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Request to Join an Organization
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Select an IMO to join. Your request will be reviewed by an
                    administrator.
                  </CardDescription>
                </CardHeader>
              </Card>
              <JoinRequestForm onSuccess={() => refetch()} />
            </>
          )}

          {/* Already Approved - Shouldn't normally see this */}
          {!isLoading &&
            !pendingRequest &&
            !eligibility?.canSubmit &&
            eligibility?.reason?.includes("already approved") && (
              <Card className="border-muted">
                <CardContent className="py-6 text-center space-y-3">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                  <div>
                    <p className="font-medium text-emerald-600">
                      You're Approved!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your account is ready. Redirecting...
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate({ to: "/" })}
                    className="mt-2"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

          {/* Sign Out */}
          <div className="pt-2">
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Help */}
          <p className="text-center text-xs text-muted-foreground">
            Questions? Contact support at support@thestandard.com
          </p>
        </div>
      </div>
    </div>
  );
};
