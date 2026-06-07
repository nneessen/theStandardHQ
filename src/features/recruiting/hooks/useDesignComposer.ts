// src/features/recruiting/hooks/useDesignComposer.ts
// Manages the AI design conversation: generate, then refine-by-chat. The spec is
// the source of truth; the conversation is ephemeral (not persisted). Every
// successful result is already validated client-side by the service.

import { useCallback, useState } from "react";
import {
  recruitingDesignService,
  type DesignConversationTurn,
  type DesignReferenceImage,
  type GenerateDesignInput,
} from "@/services/recruiting/recruitingDesignService";
import type { RecruitingDesignSpec } from "@/types/recruiting-design-spec.types";

export interface ComposerRunOptions {
  images?: DesignReferenceImage[];
  agentContext?: GenerateDesignInput["agentContext"];
  /** true = refine the current spec using the conversation; false = fresh start. */
  refine?: boolean;
}

export function useDesignComposer(initialSpec?: RecruitingDesignSpec | null) {
  const [spec, setSpec] = useState<RecruitingDesignSpec | null>(
    initialSpec ?? null,
  );
  const [conversation, setConversation] = useState<DesignConversationTurn[]>(
    [],
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const run = useCallback(
    async (
      prompt: string,
      opts: ComposerRunOptions = {},
    ): Promise<{ spec: RecruitingDesignSpec | null; error: string | null }> => {
      const trimmed = prompt.trim();
      if (!trimmed) return { spec: null, error: null };
      setIsGenerating(true);
      setError(null);
      try {
        const result = await recruitingDesignService.generateDesignSpec({
          prompt: trimmed,
          conversation: opts.refine ? conversation : [],
          currentSpec: opts.refine ? spec : null,
          referenceImages: opts.images,
          agentContext: opts.agentContext,
        });
        setSpec(result.spec);
        setNotes(result.notes);
        setConversation((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          { role: "assistant", content: "Updated your page design." },
        ]);
        return { spec: result.spec, error: null };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Couldn't generate a design.";
        setError(message);
        return { spec: null, error: message };
      } finally {
        setIsGenerating(false);
      }
    },
    [conversation, spec],
  );

  return {
    spec,
    setSpec,
    conversation,
    isGenerating,
    error,
    notes,
    run,
    hasDesign: !!spec,
  };
}
