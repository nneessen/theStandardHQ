// src/features/agent-roadmap/components/blocks/CalloutBlockView.tsx
import { Info, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";
import type { CalloutBlock, CalloutVariant } from "../../types/contentBlocks";

interface CalloutBlockViewProps {
  block: CalloutBlock;
}

/**
 * Callout variants are the most visually prominent elements in the whole
 * feature — they're how Nick draws attention to critical steps. Each variant
 * uses a full-color left border + tinted background + matching icon color
 * so they stand out from surrounding content. Tokens are from
 * tailwind.config.js semantic colors. Tip uses info tone since there's no
 * distinct "tip" token in the palette.
 */
const VARIANT_CONFIG: Record<
  CalloutVariant,
  {
    icon: typeof Info;
    container: string;
    iconBg: string;
    iconColor: string;
    label: string;
  }
> = {
  info: {
    icon: Info,
    container: "border-l-info bg-info/[0.07]",
    iconBg: "bg-info/15",
    iconColor: "text-info",
    label: "INFO",
  },
  warning: {
    icon: AlertTriangle,
    container: "border-l-warning bg-warning/[0.07]",
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    label: "WARNING",
  },
  tip: {
    icon: Lightbulb,
    container: "border-l-info bg-info/[0.07]",
    iconBg: "bg-info/15",
    iconColor: "text-info",
    label: "TIP",
  },
  success: {
    icon: CheckCircle2,
    container: "border-l-success bg-success/[0.07]",
    iconBg: "bg-success/15",
    iconColor: "text-success",
    label: "SUCCESS",
  },
};

export function CalloutBlockView({ block }: CalloutBlockViewProps) {
  const { variant, title, body } = block.data;
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-4 rounded-lg border border-border border-l-[6px] ${config.container} px-5 py-4 shadow-sm`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.iconBg}`}
      >
        <Icon className={`h-4 w-4 ${config.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div
          className={`text-[10px] font-bold uppercase tracking-widest ${config.iconColor} mb-1`}
        >
          {config.label}
        </div>
        {title && (
          <div className="text-base font-semibold text-foreground mb-1 leading-snug">
            {title}
          </div>
        )}
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {body}
        </div>
      </div>
    </div>
  );
}
