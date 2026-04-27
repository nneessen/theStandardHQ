// src/features/underwriting/components/RuleEngine/PredicateBuilder.tsx
// Wrapper component for predicate building with visual/JSON toggle

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Eye } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type { PredicateGroup } from "@/services/underwriting/core/ruleEngineDSL";
import { PredicateGroupBuilder } from "./PredicateGroupBuilder";
import { PredicateJsonEditor } from "./PredicateJsonEditor";

// ============================================================================
// Types
// ============================================================================

interface PredicateBuilderProps {
  predicate: PredicateGroup;
  onChange: (predicate: PredicateGroup) => void;
  conditionCode?: string;
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PredicateBuilder({
  predicate,
  onChange,
  conditionCode,
  disabled,
}: PredicateBuilderProps) {
  const [mode, setMode] = useState<"visual" | "json">("visual");

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "json")}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
          Predicate
        </span>
        <TabsList className="h-6">
          <TabsTrigger value="visual" className="h-5 px-2 text-[10px] gap-1">
            <Eye className="h-3 w-3" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="json" className="h-5 px-2 text-[10px] gap-1">
            <Code2 className="h-3 w-3" />
            JSON
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="visual" className="mt-0">
        <PredicateGroupBuilder
          group={predicate}
          onChange={onChange}
          conditionCode={conditionCode}
          disabled={disabled}
        />
      </TabsContent>

      <TabsContent value="json" className="mt-0">
        <PredicateJsonEditor
          predicate={predicate}
          onChange={onChange}
          disabled={disabled}
        />
      </TabsContent>
    </Tabs>
  );
}
