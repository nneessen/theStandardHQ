// src/features/agent-roadmap/components/blocks/CalloutBlockView.tsx
import { Info, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";
import type { CalloutBlock, CalloutVariant } from "../../types/contentBlocks";

interface CalloutBlockViewProps {
  block: CalloutBlock;
}

const VARIANT_CONFIG: Record<
  CalloutVariant,
  {
    icon: typeof Info;
    border: string;
    bg: string;
    iconColor: string;
    titleColor: string;
    bodyColor: string;
  }
> = {
  info: {
    icon: Info,
    border: "border-blue-200 dark:border-blue-900",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    titleColor: "text-blue-900 dark:text-blue-100",
    bodyColor: "text-blue-800 dark:text-blue-200",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-200 dark:border-amber-900",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    titleColor: "text-amber-900 dark:text-amber-100",
    bodyColor: "text-amber-800 dark:text-amber-200",
  },
  tip: {
    icon: Lightbulb,
    border: "border-purple-200 dark:border-purple-900",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    titleColor: "text-purple-900 dark:text-purple-100",
    bodyColor: "text-purple-800 dark:text-purple-200",
  },
  success: {
    icon: CheckCircle2,
    border: "border-emerald-200 dark:border-emerald-900",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    titleColor: "text-emerald-900 dark:text-emerald-100",
    bodyColor: "text-emerald-800 dark:text-emerald-200",
  },
};

export function CalloutBlockView({ block }: CalloutBlockViewProps) {
  const { variant, title, body } = block.data;
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-3 rounded-md border-l-4 ${config.border} ${config.bg} px-4 py-3`}
    >
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && (
          <div className={`text-sm font-semibold ${config.titleColor} mb-1`}>
            {title}
          </div>
        )}
        <div className={`text-sm ${config.bodyColor} whitespace-pre-wrap`}>
          {body}
        </div>
      </div>
    </div>
  );
}
