// src/features/targets/components/WelcomeTargetCard.tsx

import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeTargetCardProps {
  targetYear: number;
  onGetStarted: () => void;
}

/**
 * Welcome card shown to first-time users who haven't set an income target yet.
 * Styled to match the application's compact, professional design language.
 */
export function WelcomeTargetCard({
  targetYear,
  onGetStarted,
}: WelcomeTargetCardProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4 max-w-sm w-full shadow-sm">
        {/* Icon */}
        <div className="flex justify-center mb-3">
          <div className="p-2.5 bg-muted rounded-full">
            <Target className="h-5 w-5 text-foreground" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-sm font-semibold text-v2-ink text-center mb-1.5">
          Set Your {targetYear} Income Target
        </h2>

        {/* Description */}
        <p className="text-[11px] text-v2-ink-muted text-center mb-4 leading-relaxed">
          Enter your annual net income goal to get started. We'll automatically
          calculate monthly, weekly, and daily targets based on your historical
          performance data.
        </p>

        {/* CTA Button */}
        <Button onClick={onGetStarted} className="w-full h-8 text-[11px]">
          <Target className="h-3.5 w-3.5 mr-1.5" />
          Get Started
        </Button>

        {/* Helper text */}
        <p className="text-[10px] text-muted-foreground text-center mt-2.5">
          You can adjust your target anytime from this page
        </p>
      </div>
    </div>
  );
}
