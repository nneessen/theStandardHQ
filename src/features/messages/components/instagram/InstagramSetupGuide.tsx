// src/features/messages/components/instagram/InstagramSetupGuide.tsx
// Setup guide dialog explaining how to set up an Instagram Business account

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Building2,
  Link2,
  HelpCircle,
} from "lucide-react";

interface InstagramSetupGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstagramSetupGuide({
  open,
  onOpenChange,
}: InstagramSetupGuideProps): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-semibold text-v2-ink">
            Instagram Business Account Setup
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-80px)] px-4 pb-4">
          <div className="space-y-4">
            {/* Section 1: What You Need */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                  What You Need
                </h3>
              </div>
              <div className="bg-v2-canvas rounded-md p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                    1.
                  </span>
                  <p className="text-[11px] text-v2-ink-muted">
                    <strong>Instagram Business or Creator account</strong> (not
                    Personal)
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                    2.
                  </span>
                  <p className="text-[11px] text-v2-ink-muted">
                    <strong>A Facebook Page</strong> connected to your Instagram
                    account
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                    3.
                  </span>
                  <p className="text-[11px] text-v2-ink-muted">
                    <strong>Admin access</strong> to both your Instagram and
                    Facebook Page
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Convert to Business Account */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                  Convert to Business Account
                </h3>
              </div>
              <div className="bg-v2-canvas rounded-md p-3 space-y-2">
                <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
                  If you have a Personal account, convert it to Business or
                  Creator:
                </p>
                <ol className="space-y-1.5 text-[11px] text-v2-ink-muted">
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      1.
                    </span>
                    Open Instagram and go to your profile
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      2.
                    </span>
                    Tap the menu (≡) → Settings → Account
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      3.
                    </span>
                    Tap "Switch to Professional Account"
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      4.
                    </span>
                    Choose "Business" or "Creator" based on your needs
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      5.
                    </span>
                    Follow the prompts to complete setup
                  </li>
                </ol>
                <a
                  href="https://help.instagram.com/502981923235522"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-2"
                >
                  Instagram Help: Set up a Business account
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </section>

            {/* Section 3: Connect Facebook Page */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Link2 className="h-3.5 w-3.5 text-purple-500" />
                <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                  Connect a Facebook Page
                </h3>
              </div>
              <div className="bg-v2-canvas rounded-md p-3 space-y-2">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    A Facebook Page is required because Instagram's messaging
                    API is accessed through Meta's Business platform.
                  </p>
                </div>
                <ol className="space-y-1.5 text-[11px] text-v2-ink-muted">
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      1.
                    </span>
                    Go to your Instagram profile → Edit profile
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      2.
                    </span>
                    Tap "Page" under "Profile information"
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      3.
                    </span>
                    Select an existing Page or create a new one
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[10px] font-medium text-v2-ink-muted mt-0.5">
                      4.
                    </span>
                    Confirm the connection
                  </li>
                </ol>
                <a
                  href="https://help.instagram.com/570895513091465"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-2"
                >
                  Instagram Help: Connect to a Facebook Page
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </section>

            {/* Section 4: Troubleshooting */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <HelpCircle className="h-3.5 w-3.5 text-v2-ink-muted" />
                <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                  Troubleshooting
                </h3>
              </div>
              <div className="bg-v2-canvas rounded-md p-3 space-y-3">
                <div>
                  <p className="text-[11px] font-medium text-v2-ink-muted">
                    "I don't see the option to connect a Page"
                  </p>
                  <p className="text-[10px] text-v2-ink-muted mt-0.5">
                    Make sure you've switched to a Business or Creator account
                    first. Personal accounts cannot connect to Facebook Pages.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-v2-ink-muted">
                    "Connection failed during OAuth"
                  </p>
                  <p className="text-[10px] text-v2-ink-muted mt-0.5">
                    Ensure you have admin access to the Facebook Page. Only
                    admins can authorize messaging integrations.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-v2-ink-muted">
                    "My Facebook Page doesn't appear"
                  </p>
                  <p className="text-[10px] text-v2-ink-muted mt-0.5">
                    You may need to request admin access from the current Page
                    admin, or create a new Page for your business.
                  </p>
                </div>
              </div>
            </section>

            {/* Close button */}
            <div className="pt-2">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                size="sm"
                className="w-full h-7 text-[11px]"
              >
                Got it
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
