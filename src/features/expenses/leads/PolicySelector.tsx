// src/features/expenses/leads/PolicySelector.tsx

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, FileText, Plus, Loader2 } from "lucide-react";
import {
  useUnlinkedRecentPolicies,
  useUpdatePolicyLeadSource,
} from "@/features/policies";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Policy } from "@/types/policy.types";

interface PolicySelectorProps {
  leadPurchaseId: string;
  onPolicyLinked?: () => void;
}

export function PolicySelector({
  leadPurchaseId,
  onPolicyLinked,
}: PolicySelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();

  const { data: policies = [], isLoading } = useUnlinkedRecentPolicies(
    user?.id,
  );
  const updateLeadSource = useUpdatePolicyLeadSource();

  const filteredPolicies = useMemo(() => {
    if (!searchTerm.trim()) return policies;

    const term = searchTerm.toLowerCase();
    return policies.filter((policy) => {
      const clientName = policy.client?.name?.toLowerCase() || "";
      const policyNumber = policy.policyNumber?.toLowerCase() || "";
      return clientName.includes(term) || policyNumber.includes(term);
    });
  }, [policies, searchTerm]);

  const handleLinkPolicy = async (policy: Policy) => {
    try {
      await updateLeadSource.mutateAsync({
        policyId: policy.id,
        leadSourceType: "lead_purchase",
        leadPurchaseId,
      });
      toast.success(
        `Linked "${policy.client?.name || "Policy"}" to this lead purchase`,
      );
      setSearchTerm("");
      onPolicyLinked?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to link policy",
      );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search client or policy #..."
          className="h-9 pl-9 bg-v2-card border-v2-ring"
        />
      </div>

      {/* Policy list */}
      <div className="flex-1 min-h-0 border border-border rounded-md overflow-hidden bg-background">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredPolicies.length > 0 ? (
          <ScrollArea className="h-full max-h-[160px]">
            <div className="divide-y divide-border">
              {filteredPolicies.map((policy) => (
                <PolicyItem
                  key={policy.id}
                  policy={policy}
                  onLink={() => handleLinkPolicy(policy)}
                  isLinking={
                    updateLeadSource.isPending &&
                    updateLeadSource.variables?.policyId === policy.id
                  }
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="px-3 py-6 text-center">
            <FileText className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "No policies match" : "No unlinked policies"}
            </p>
          </div>
        )}
      </div>

      {/* Count */}
      {policies.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {filteredPolicies.length} of {policies.length} available
        </p>
      )}
    </div>
  );
}

interface PolicyItemProps {
  policy: Policy;
  onLink: () => void;
  isLinking: boolean;
}

function PolicyItem({ policy, onLink, isLinking }: PolicyItemProps) {
  const formattedDate = new Date(policy.effectiveDate).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {policy.client?.name || "Unknown Client"}
        </div>
        <div className="text-xs text-muted-foreground">
          {policy.policyNumber && `#${policy.policyNumber} · `}
          {formattedDate}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2.5 text-xs shadow-sm"
        onClick={onLink}
        disabled={isLinking}
      >
        {isLinking ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Plus className="h-3 w-3 mr-1" />
            Link
          </>
        )}
      </Button>
    </div>
  );
}
