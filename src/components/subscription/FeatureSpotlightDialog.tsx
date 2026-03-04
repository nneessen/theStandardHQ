// src/components/subscription/FeatureSpotlightDialog.tsx
// Dynamic feature spotlight dialog — rich two-column layout with integration logos

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useNavigate } from "@tanstack/react-router";
import type {
  FeatureSpotlight,
  SpotlightHighlight,
} from "@/hooks/subscription";
import {
  Bot,
  Calendar,
  Zap,
  Clock,
  BarChart3,
  Users,
  Sparkles,
  Star,
  Shield,
  Target,
  Mail,
  MessageSquare,
  TrendingUp,
  Award,
  Crown,
  Rocket,
  Globe,
  Lock,
  Eye,
  Bell,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

// ─── Icon Map ───────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Bot,
  Calendar,
  Zap,
  Clock,
  BarChart3,
  Users,
  Sparkles,
  Star,
  Shield,
  Target,
  Mail,
  MessageSquare,
  TrendingUp,
  Award,
  Crown,
  Rocket,
  Globe,
  Lock,
  Eye,
  Bell,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Sparkles;
}

// ─── Integration Logos (SVG) ────────────────────────────────────
function CloseCrmLogo({ className }: { className?: string }) {
  return (
    <img
      src="/close-crm-logo.jpg"
      alt="Close CRM"
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

function CalendlyLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M27.4166 25.9298C26.1216 27.0554 24.5105 28.4566 21.5764 28.4566H19.8247C17.7043 28.4566 15.7759 27.702 14.3955 26.3307C13.0478 24.9914 12.3043 23.1595 12.3043 21.1702V18.8179C12.3043 16.8286 13.0466 14.9955 14.3955 13.6574C15.7759 12.286 17.7043 11.5314 19.8247 11.5314H21.5764C24.5105 11.5314 26.1216 12.9326 27.4166 14.0582C28.7596 15.2263 29.9199 16.2348 33.0098 16.2348C33.4898 16.2348 33.9605 16.1969 34.4183 16.1245C34.4148 16.1153 34.4113 16.1073 34.4078 16.0981C34.224 15.6513 34.0073 15.2125 33.758 14.7887L31.6914 11.2776C29.7958 8.05585 26.2914 6.07227 22.5002 6.07227H18.367C14.5758 6.07227 11.0714 8.05699 9.17577 11.2776L7.10922 14.7887C5.21359 18.0105 5.21359 21.9787 7.10922 25.1993L9.17577 28.7105C11.0714 31.9322 14.5758 33.9158 18.367 33.9158H22.5002C26.2914 33.9158 29.7958 31.9311 31.6914 28.7105L33.758 25.1993C34.0073 24.7744 34.224 24.3367 34.4078 23.89C34.4113 23.8808 34.4148 23.8727 34.4183 23.8635C33.9605 23.7912 33.491 23.7533 33.0098 23.7533C29.9199 23.7533 28.7596 24.7617 27.4166 25.9298Z"
        fill="#006BFF"
      />
      <path
        d="M21.5767 13.6621H19.825C16.5982 13.6621 14.4766 15.9236 14.4766 18.818V21.1703C14.4766 24.0647 16.597 26.3262 19.825 26.3262H21.5767C26.2788 26.3262 25.91 21.6228 33.0101 21.6228C33.6904 21.6228 34.3624 21.6837 35.0169 21.8031C35.2324 20.6075 35.2324 19.3831 35.0169 18.1863C34.3624 18.3058 33.6904 18.3666 33.0101 18.3666C25.91 18.3655 26.2788 13.6621 21.5767 13.6621Z"
        fill="#006BFF"
      />
      <path
        d="M39.095 23.5203C37.882 22.6428 36.491 22.0708 35.0157 21.8009C35.0134 21.8124 35.0122 21.8239 35.0099 21.8354C34.8834 22.5245 34.6867 23.2033 34.4174 23.8614C35.662 24.059 36.8095 24.5184 37.7895 25.2225C37.786 25.2328 37.7836 25.2432 37.7801 25.2547C37.2146 27.0556 36.3622 28.7532 35.2476 30.298C34.1458 31.8233 32.8145 33.166 31.2889 34.2881C28.1217 36.6186 24.3492 37.8498 20.3776 37.8498C17.9188 37.8498 15.535 37.3778 13.2916 36.4474C11.1243 35.5481 9.17718 34.2605 7.50402 32.6192C5.83086 30.9779 4.51835 29.0679 3.60156 26.9419C2.65317 24.7412 2.17194 22.4028 2.17194 19.9908C2.17194 17.5788 2.65317 15.2403 3.60156 13.0397C4.51835 10.9137 5.83086 9.0036 7.50402 7.3623C9.17718 5.721 11.1243 4.43346 13.2916 3.53414C15.535 2.6038 17.9188 2.13174 20.3776 2.13174C24.3492 2.13174 28.1217 3.36301 31.2889 5.69345C32.8145 6.81559 34.1458 8.15827 35.2476 9.68356C36.3622 11.2284 37.2146 12.926 37.7801 14.7269C37.7836 14.7384 37.7871 14.7487 37.7895 14.7591C36.8095 15.4631 35.662 15.9237 34.4174 16.1201C34.6867 16.7794 34.8846 17.4593 35.0099 18.1485C35.0122 18.16 35.0134 18.1703 35.0157 18.1818C36.491 17.9119 37.8808 17.3399 39.095 16.4624C40.2576 15.6182 40.0328 14.6649 39.856 14.0998C37.293 5.93464 29.542 0 20.3776 0C9.12334 0 0 8.94962 0 19.9896C0 31.0296 9.12334 39.9793 20.3776 39.9793C29.542 39.9793 37.293 34.0446 39.856 25.8795C40.0328 25.3178 40.2588 24.3645 39.095 23.5203Z"
        fill="#006BFF"
      />
      <path
        d="M34.4187 16.1224C33.9609 16.1948 33.4914 16.2327 33.0102 16.2327C29.9203 16.2327 28.76 15.2242 27.417 14.0561C26.122 12.9305 24.5109 11.5293 21.5767 11.5293H19.8251C17.7047 11.5293 15.7763 12.2839 14.3959 13.6553C13.0482 14.9945 12.3047 16.8265 12.3047 18.8158V21.1681C12.3047 23.1574 13.047 24.9905 14.3959 26.3286C15.7763 27.6999 17.7047 28.4546 19.8251 28.4546H21.5767C24.5109 28.4546 26.122 27.0533 27.417 25.9277C28.76 24.7596 29.9203 23.7512 33.0102 23.7512C33.4902 23.7512 33.9609 23.7891 34.4187 23.8614C34.688 23.2033 34.8847 22.5234 35.0112 21.8354C35.0135 21.8239 35.0147 21.8124 35.017 21.8009C34.3625 21.6815 33.6904 21.6206 33.0102 21.6206C25.9101 21.6206 26.2789 26.324 21.5767 26.324H19.8251C16.5983 26.324 14.4766 24.0624 14.4766 21.1681V18.8158C14.4766 15.9214 16.5971 13.6599 19.8251 13.6599H21.5767C26.2789 13.6599 25.9101 18.3633 33.0102 18.3633C33.6904 18.3633 34.3625 18.3024 35.017 18.1829C35.0147 18.1715 35.0135 18.1611 35.0112 18.1496C34.8859 17.4616 34.688 16.7817 34.4187 16.1224Z"
        fill="#0AE8F0"
      />
    </svg>
  );
}

function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M152.637 47.363H47.363v105.274h105.274V47.363z" fill="#fff" />
      <path d="M152.637 200L200 152.637h-47.363V200z" fill="#EA4335" />
      <path d="M200 47.363h-47.363v105.274H200V47.363z" fill="#FBBC04" />
      <path
        d="M152.637 152.637H47.363V200l52.637-26.318L152.637 200v-47.363z"
        fill="#34A853"
      />
      <path d="M0 152.637V200h47.363v-47.363H0z" fill="#188038" />
      <path d="M47.363 47.363V0L0 47.363h47.363z" fill="#1967D2" />
      <path d="M47.363 0v47.363h105.274L100 21.181 47.363 0z" fill="#4285F4" />
      <path d="M0 47.363v105.274h47.363V47.363H0z" fill="#4285F4" />
      <path
        d="M78.438 132.227c-4.675-3.152-7.903-7.754-9.672-13.792l10.834-4.463c1.04 3.96 2.807 7.033 5.301 9.22 2.494 2.186 5.507 3.265 9.013 3.265 3.59 0 6.679-1.147 9.268-3.44 2.59-2.294 3.884-5.178 3.884-8.652 0-3.558-1.352-6.49-4.057-8.8-2.704-2.31-6.084-3.464-10.138-3.464h-6.283v-10.72h5.65c3.59 0 6.603-1.03 9.04-3.09 2.437-2.06 3.655-4.83 3.655-8.31 0-3.134-1.11-5.656-3.33-7.57-2.22-1.912-5.022-2.868-8.406-2.868-3.3 0-5.93.918-7.896 2.752-1.965 1.835-3.384 4.076-4.21 6.627L70.364 74.91c1.36-4.326 3.963-8.116 7.965-11.228 3.894-3.037 8.915-4.622 14.674-4.622 4.39 0 8.368.878 11.894 2.636 3.527 1.758 6.297 4.21 8.31 7.36 2.013 3.148 3.02 6.674 3.02 10.578 0 3.988-.95 7.37-2.848 10.147-1.898 2.777-4.23 4.87-6.997 6.277v.693c3.558 1.495 6.413 3.808 8.637 6.99 2.224 3.182 3.323 6.92 3.323 11.17 0 4.25-1.098 8.076-3.295 11.477-2.196 3.4-5.252 6.075-9.168 8.023-3.916 1.95-8.348 2.923-13.296 2.923-5.684 0-10.827-1.576-15.502-4.728l-.643-.355z"
        fill="#4285F4"
      />
      <path
        d="M141.426 72.082l-11.903 8.598-5.997-9.1 20.964-15.12h8.252v78.27h-11.316V72.082z"
        fill="#4285F4"
      />
    </svg>
  );
}

const LOGO_COMPONENTS: Record<string, React.FC<{ className?: string }>> = {
  close_crm: CloseCrmLogo,
  calendly: CalendlyLogo,
  google_calendar: GoogleCalendarLogo,
};

const LOGO_LABELS: Record<string, string> = {
  close_crm: "Close CRM",
  calendly: "Calendly",
  google_calendar: "Google Calendar",
};

// ─── Component ──────────────────────────────────────────────────

interface FeatureSpotlightDialogProps {
  spotlight: FeatureSpotlight;
  open: boolean;
  onDismiss: () => void;
}

export function FeatureSpotlightDialog({
  spotlight,
  open,
  onDismiss,
}: FeatureSpotlightDialogProps) {
  const navigate = useNavigate();
  const HeroIcon = resolveIcon(spotlight.hero_icon);
  const accentColor = spotlight.accent_color || "#3b82f6";
  const logos = spotlight.logos || [];

  const handleCta = () => {
    onDismiss();
    navigate({ to: spotlight.cta_link });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent
        size="full"
        hideCloseButton
        className="p-0 overflow-hidden bg-background border-0"
      >
        <VisuallyHidden>
          <DialogTitle>{spotlight.title}</DialogTitle>
          <DialogDescription>
            {spotlight.subtitle || "Feature spotlight"}
          </DialogDescription>
        </VisuallyHidden>

        <div className="h-[90vh] flex flex-col lg:flex-row">
          {/* ══════ Left Panel — Dark Hero ══════ */}
          <div className="lg:w-[45%] bg-foreground relative hidden lg:flex flex-col overflow-hidden">
            {/* Grid background */}
            <div className="absolute inset-0 opacity-[0.04]">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern
                    id="spotlight-grid"
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
                <rect width="100%" height="100%" fill="url(#spotlight-grid)" />
              </svg>
            </div>

            {/* Glow orbs */}
            <div
              className="absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl animate-pulse"
              style={{ backgroundColor: `${accentColor}18` }}
            />
            <div
              className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl animate-pulse"
              style={{
                backgroundColor: `${accentColor}10`,
                animationDelay: "1s",
              }}
            />
            <div
              className="absolute top-2/3 left-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse"
              style={{
                backgroundColor: `${accentColor}0c`,
                animationDelay: "2s",
              }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col justify-between p-8 xl:p-10 h-full">
              {/* Logo + brand */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-xl blur-xl transition-all"
                    style={{ backgroundColor: `${accentColor}33` }}
                  />
                  <img
                    src="/logos/Light Letter Logo .png"
                    alt="The Standard"
                    className="relative h-12 w-12 drop-shadow-2xl dark:hidden"
                  />
                  <img
                    src="/logos/LetterLogo.png"
                    alt="The Standard"
                    className="relative h-12 w-12 drop-shadow-2xl hidden dark:block"
                  />
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-white dark:text-black text-xl font-bold tracking-wide"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    THE STANDARD
                  </span>
                  <span
                    className="text-[9px] uppercase tracking-[0.3em] font-medium"
                    style={{ color: accentColor }}
                  >
                    Financial Group
                  </span>
                </div>
              </div>

              {/* Center content */}
              <div className="space-y-8 flex-1 flex flex-col justify-center">
                {/* Badge */}
                <div
                  className="inline-flex items-center gap-2 border rounded-full px-3 py-1.5 w-fit"
                  style={{
                    backgroundColor: `${accentColor}33`,
                    borderColor: `${accentColor}4d`,
                  }}
                >
                  <Sparkles
                    className="h-3.5 w-3.5"
                    style={{ color: accentColor }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: accentColor }}
                  >
                    New Feature
                  </span>
                </div>

                {/* Hero icon */}
                <div
                  className="flex items-center justify-center w-20 h-20 rounded-2xl"
                  style={{ backgroundColor: `${accentColor}25` }}
                >
                  <HeroIcon
                    className="h-10 w-10"
                    style={{ color: accentColor }}
                  />
                </div>

                {/* Title */}
                <div>
                  <h1
                    className="text-3xl xl:text-4xl font-bold leading-tight mb-3"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    <span className="text-white dark:text-black">
                      {spotlight.title}
                    </span>
                  </h1>
                  {spotlight.subtitle && (
                    <p className="text-white/60 dark:text-black/50 text-base max-w-sm leading-relaxed">
                      {spotlight.subtitle}
                    </p>
                  )}
                </div>

                {/* Integration logos */}
                {logos.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-white/40 dark:text-black/40 text-[10px] uppercase tracking-widest font-medium">
                      Integrates with
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {logos.map((logoKey) => {
                        const LogoComponent = LOGO_COMPONENTS[logoKey];
                        const label = LOGO_LABELS[logoKey] || logoKey;
                        if (!LogoComponent) return null;
                        return (
                          <div
                            key={logoKey}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-white/10 dark:border-black/10 bg-white/5 dark:bg-black/5"
                          >
                            <LogoComponent className="h-6 w-6 rounded flex-shrink-0" />
                            <span className="text-white/70 dark:text-black/60 text-xs font-medium">
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom */}
              <div className="text-white/40 dark:text-black/40 text-xs">
                &copy; {new Date().getFullYear()} The Standard Financial Group
              </div>
            </div>
          </div>

          {/* ══════ Right Panel — Content ══════ */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-background">
            {/* Mobile Header */}
            <div className="lg:hidden p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/logos/LetterLogo.png"
                    alt="The Standard"
                    className="h-8 w-8 dark:hidden"
                  />
                  <img
                    src="/logos/Light Letter Logo .png"
                    alt="The Standard"
                    className="h-8 w-8 hidden dark:block"
                  />
                  <span
                    className="text-foreground font-bold"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    THE STANDARD
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5 rounded-full px-2 py-1"
                  style={{ backgroundColor: `${accentColor}33` }}
                >
                  <Sparkles
                    className="h-3 w-3"
                    style={{ color: accentColor }}
                  />
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: accentColor }}
                  >
                    New Feature
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-5 lg:p-8 xl:p-10 flex flex-col">
              {/* Title */}
              <div className="mb-6">
                <h2
                  className="text-2xl lg:text-3xl font-bold text-foreground mb-3"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {spotlight.title}
                </h2>
                {spotlight.description && (
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                    {spotlight.description}
                  </p>
                )}
              </div>

              {/* Highlights grid */}
              {spotlight.highlights.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    What&apos;s Included
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {spotlight.highlights.map(
                      (highlight: SpotlightHighlight, index: number) => {
                        const HighlightIcon = resolveIcon(highlight.icon);
                        return (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/30"
                          >
                            <div
                              className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                              style={{ backgroundColor: `${accentColor}15` }}
                            >
                              <HighlightIcon
                                className="h-4.5 w-4.5"
                                style={{ color: accentColor }}
                              />
                            </div>
                            <span className="text-foreground text-sm font-medium leading-snug pt-1.5">
                              {highlight.label}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {/* Mobile logos */}
              {logos.length > 0 && (
                <div className="lg:hidden mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Integrations
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    {logos.map((logoKey) => {
                      const LogoComponent = LOGO_COMPONENTS[logoKey];
                      const label = LOGO_LABELS[logoKey] || logoKey;
                      if (!LogoComponent) return null;
                      return (
                        <div
                          key={logoKey}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-muted/30"
                        >
                          <LogoComponent className="h-6 w-6 rounded flex-shrink-0" />
                          <span className="text-xs font-medium text-foreground">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-6 border-t border-border/50">
                <Button
                  onClick={handleCta}
                  size="lg"
                  className="w-full sm:w-auto text-white shadow-lg px-8 gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                    boxShadow: `0 4px 14px ${accentColor}40`,
                  }}
                >
                  {spotlight.cta_text}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={onDismiss}
                  className="w-full sm:w-auto text-muted-foreground"
                >
                  Maybe later
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
