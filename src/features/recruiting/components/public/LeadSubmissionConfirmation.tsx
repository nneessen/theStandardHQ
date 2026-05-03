// src/features/recruiting/components/public/LeadSubmissionConfirmation.tsx
// Confirmation page shown after successful lead submission - Visual redesign v2

import { useState } from "react";
import { CheckCircle2, Calendar, ArrowRight, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicRecruiterInfo } from "@/types/leads.types";

interface LeadSubmissionConfirmationProps {
  leadId: string;
  recruiterInfo: PublicRecruiterInfo;
}

export function LeadSubmissionConfirmation({
  leadId,
  recruiterInfo,
}: LeadSubmissionConfirmationProps) {
  const [showCalendly, setShowCalendly] = useState(false);

  // Check if recruiter has Calendly URL configured
  const hasCalendly = !!recruiterInfo.calendly_url;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Dark Celebration */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-foreground relative overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid-confirm"
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
            <rect width="100%" height="100%" fill="url(#grid-confirm)" />
          </svg>
        </div>

        {/* Animated glow orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-success/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 -right-20 w-80 h-80 bg-success/70/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo and brand - Enhanced */}
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <div className="absolute inset-0 bg-success/20 rounded-xl blur-xl group-hover:bg-success/30 transition-all duration-500" />
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
                className="text-white text-2xl font-bold tracking-wide"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                THE STANDARD
              </span>
              <span className="text-success text-[10px] uppercase tracking-[0.3em] font-medium">
                Financial Group
              </span>
            </div>
          </div>

          {/* Middle - Success messaging */}
          <div className="space-y-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success/20">
                <PartyPopper className="h-8 w-8 text-success" />
              </div>
            </div>
            <div>
              <h1
                className="text-4xl xl:text-5xl font-bold leading-tight mb-4"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="text-white">You&apos;re </span>
                <span className="bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 bg-clip-text text-transparent">
                  In!
                </span>
                <br />
                <span className="text-white/70">We&apos;ll Be In Touch</span>
              </h1>
              <p className="text-white/70 text-lg max-w-md">
                Thank you for expressing your interest in joining The Standard
                team. A member of our team will reach out within 24-48 hours to
                discuss the next steps.
              </p>
            </div>

            {/* Reference number */}
            <div className="inline-block px-4 py-2 bg-white/10 dark:bg-white/10 rounded-lg">
              <p className="text-xs text-white/50">Reference Number</p>
              <p className="text-sm font-mono text-white/80">
                {leadId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Bottom */}
          <div className="text-white/50 text-sm">
            &copy; {new Date().getFullYear()} The Standard Financial Group
          </div>
        </div>
      </div>

      {/* Right Panel - Next Steps */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-[440px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
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
            <span className="text-foreground text-xl font-semibold tracking-tight">
              THE STANDARD
            </span>
          </div>

          {/* Mobile success icon */}
          <div className="lg:hidden flex justify-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 dark:bg-success/10/50">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </div>

          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Thank You!
            </h2>
            <p className="text-sm text-muted-foreground">
              Your interest has been submitted successfully.
            </p>
          </div>

          {/* What Happens Next Card */}
          <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 shadow-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              What Happens Next?
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/20 dark:bg-warning/10/50 flex items-center justify-center">
                  <span className="text-xs font-bold text-warning">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Review Your Application
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Our team will review your submission and qualifications.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/20 dark:bg-warning/10/50 flex items-center justify-center">
                  <span className="text-xs font-bold text-warning">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Discovery Call
                  </p>
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll schedule a call to learn more about your goals
                    and answer any questions.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/20 dark:bg-warning/10/50 flex items-center justify-center">
                  <span className="text-xs font-bold text-warning">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Start Your Journey
                  </p>
                  <p className="text-xs text-muted-foreground">
                    If it&apos;s a good fit, we&apos;ll get you started on our
                    onboarding process.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Call CTA */}
          {hasCalendly && !showCalendly && (
            <div className="bg-foreground rounded-xl p-6 text-center">
              <Calendar className="h-8 w-8 text-background mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-background mb-2">
                Want to Speed Things Up?
              </h3>
              <p className="text-sm text-background/70 mb-4">
                Skip the wait and schedule your discovery call right now.
              </p>
              <Button
                onClick={() => setShowCalendly(true)}
                className="bg-warning hover:bg-warning text-black font-semibold"
              >
                Schedule a Call
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Calendly Embed */}
          {hasCalendly && showCalendly && recruiterInfo.calendly_url && (
            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 shadow-xl overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <h3 className="text-sm font-semibold text-foreground">
                  Schedule Your Discovery Call
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select a time that works best for you.
                </p>
              </div>
              <div className="aspect-[4/3]">
                <iframe
                  src={`${recruiterInfo.calendly_url}?hide_gdpr_banner=1&hide_event_type_details=1`}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  title="Schedule a call"
                />
              </div>
            </div>
          )}

          {/* Mobile Reference Number */}
          <p className="lg:hidden text-xs text-muted-foreground text-center mt-6">
            Reference: {leadId.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
}
