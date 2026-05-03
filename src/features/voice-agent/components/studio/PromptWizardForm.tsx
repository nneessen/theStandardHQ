import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  DollarSign,
  ListChecks,
  MessageSquare,
  Phone,
  Route,
  ShieldAlert,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { assemblePrompt } from "../../lib/prompt-assembler";
import type { PromptWizardFormData } from "../../lib/prompt-wizard-types";
import {
  EMPTY_WIZARD_FORM,
  loadWizardData,
  saveWizardData,
} from "../../lib/prompt-wizard-types";
import { IdentitySection } from "./wizard-sections/IdentitySection";
import { StyleSection } from "./wizard-sections/StyleSection";
import { ProductsSection } from "./wizard-sections/ProductsSection";
import { QualificationSection } from "./wizard-sections/QualificationSection";
import { PricingSection } from "./wizard-sections/PricingSection";
import { HardLimitsSection } from "./wizard-sections/HardLimitsSection";
import { TransferRulesSection } from "./wizard-sections/TransferRulesSection";
import { WorkflowsSection } from "./wizard-sections/WorkflowsSection";
import { PromptPreviewPanel } from "./PromptPreviewPanel";

interface WizardSectionConfig {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const SECTIONS: WizardSectionConfig[] = [
  {
    key: "identity",
    icon: <Building2 className="h-4 w-4" />,
    title: "Tell us about your agency",
    description: "Your agent's name, agency, and timezone.",
  },
  {
    key: "style",
    icon: <Volume2 className="h-4 w-4" />,
    title: "How should your agent sound?",
    description: "Tone, pace, and personality on calls.",
  },
  {
    key: "products",
    icon: <ListChecks className="h-4 w-4" />,
    title: "What products can it discuss?",
    description: "Topics your agent can talk about in general terms.",
  },
  {
    key: "qualification",
    icon: <MessageSquare className="h-4 w-4" />,
    title: "What should it ask callers?",
    description:
      "Questions to qualify a caller before connecting them with you.",
  },
  {
    key: "pricing",
    icon: <DollarSign className="h-4 w-4" />,
    title: "How should it handle pricing questions?",
    description: "What to say when callers ask about rates or cost.",
  },
  {
    key: "hardLimits",
    icon: <ShieldAlert className="h-4 w-4" />,
    title: "What should it never do?",
    description: "Compliance guardrails and safety rules.",
  },
  {
    key: "transfer",
    icon: <Phone className="h-4 w-4" />,
    title: "When should it transfer to you?",
    description: "Situations where the agent hands off to a live person.",
  },
  {
    key: "workflows",
    icon: <Route className="h-4 w-4" />,
    title: "Customize call openings by scenario",
    description: "How the agent greets callers depending on the situation.",
  },
];

interface PromptWizardFormProps {
  onPromptChange: (prompt: string) => void;
}

export function PromptWizardForm({ onPromptChange }: PromptWizardFormProps) {
  const [formData, setFormData] = useState<PromptWizardFormData>(() => {
    return loadWizardData() ?? { ...EMPTY_WIZARD_FORM };
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(SECTIONS.map((s) => s.key)),
  );

  // Debounced save to localStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const handleChange = useCallback(
    (patch: Partial<PromptWizardFormData>) => {
      setFormData((prev) => {
        const next = { ...prev, ...patch };

        // Assemble and propagate immediately for responsive preview
        const prompt = assemblePrompt(next);
        onPromptChange(prompt);

        // Debounce localStorage save
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveWizardData(next), 300);

        return next;
      });
    },
    [onPromptChange],
  );

  // Initial assemble on mount
  useEffect(() => {
    onPromptChange(assemblePrompt(formData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(saveTimerRef.current);
  }, []);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const assembledPrompt = assemblePrompt(formData);

  const renderSectionContent = (key: string) => {
    switch (key) {
      case "identity":
        return <IdentitySection data={formData} onChange={handleChange} />;
      case "style":
        return <StyleSection data={formData} onChange={handleChange} />;
      case "products":
        return <ProductsSection data={formData} onChange={handleChange} />;
      case "qualification":
        return <QualificationSection data={formData} onChange={handleChange} />;
      case "pricing":
        return <PricingSection data={formData} onChange={handleChange} />;
      case "hardLimits":
        return <HardLimitsSection data={formData} onChange={handleChange} />;
      case "transfer":
        return <TransferRulesSection data={formData} onChange={handleChange} />;
      case "workflows":
        return <WorkflowsSection data={formData} onChange={handleChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      {/* Left: Wizard sections */}
      <div className="space-y-2">
        {SECTIONS.map((section) => {
          const isOpen = expandedSections.has(section.key);
          return (
            <div
              key={section.key}
              className="rounded-lg border border-v2-ring dark:border-v2-ring"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggleSection(section.key)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-muted flex-shrink-0">
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                    {section.title}
                  </p>
                  <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                    {section.description}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-v2-ink-subtle transition-transform flex-shrink-0",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <div className="border-t border-v2-ring px-4 py-3 dark:border-v2-ring">
                  {renderSectionContent(section.key)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Right: Live preview */}
      <div className="xl:sticky xl:top-4 xl:self-start">
        <PromptPreviewPanel prompt={assembledPrompt} />
      </div>
    </div>
  );
}
