// src/features/contracting/components/MyCarrierContractsCard.tsx

import { Switch } from "@/components/ui/switch";
import { Loader2, Briefcase, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAgentContractToggleCarriers,
  useVisibleAgentContracts,
  useToggleVisibleAgentContract,
} from "../hooks/useContracts";

interface AgentCarrierContractsCardProps {
  agentId: string;
  title?: string;
  description?: string;
  className?: string;
  disableToggle?: boolean;
}

interface MyCarrierContractsCardProps {
  agentId: string;
}

export function AgentCarrierContractsCard({
  agentId,
  title = "Carrier Contracts",
  description = "Toggle carriers that are actively contracted for this agent.",
  className,
  disableToggle = false,
}: AgentCarrierContractsCardProps) {
  const {
    data: carriers,
    isLoading: carriersLoading,
    error: carriersError,
  } = useAgentContractToggleCarriers(agentId);

  const {
    data: contracts,
    isLoading: contractsLoading,
    error: contractsError,
  } = useVisibleAgentContracts(agentId);

  const toggleContract = useToggleVisibleAgentContract(agentId);

  const isLoading = carriersLoading || contractsLoading;
  const error = carriersError || contractsError;
  const contractMap = new Map((contracts || []).map((c) => [c.carrier_id, c]));

  const handleToggle = (carrierId: string, currentlyActive: boolean) => {
    if (disableToggle) return;

    toggleContract.mutate({
      carrierId,
      active: !currentlyActive,
    });
  };

  return (
    <div
      className={cn(
        "bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring",
        className,
      )}
    >
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring flex items-center gap-2">
        <Briefcase className="h-3.5 w-3.5 text-v2-ink-subtle" />
        <h3 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink uppercase tracking-wide">
          {title}
        </h3>
      </div>

      {isLoading ? (
        <div className="p-4 text-center">
          <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle mx-auto" />
        </div>
      ) : error ? (
        <div className="p-3 flex items-center gap-2 text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          <p className="text-[10px]">Failed to load carrier contracts</p>
        </div>
      ) : !carriers || carriers.length === 0 ? (
        <div className="p-3 text-center">
          <p className="text-[10px] text-v2-ink-muted">
            No carriers configured for this agent&apos;s organization
          </p>
        </div>
      ) : (
        <div className="divide-y divide-v2-ring dark:divide-v2-ring">
          {carriers.map((carrier) => {
            const contract = contractMap.get(carrier.id);
            const isActive = contract?.status === "approved";
            const writingNumber = contract?.writing_number;

            return (
              <div
                key={carrier.id}
                className="flex items-center justify-between px-3 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink truncate">
                    {carrier.name}
                  </p>
                  {writingNumber && (
                    <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                      #{writingNumber}
                    </p>
                  )}
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={() => handleToggle(carrier.id, isActive)}
                  disabled={disableToggle || toggleContract.isPending}
                  className="scale-75"
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-v2-ring dark:border-v2-ring">
        <p className="text-[9px] text-v2-ink-subtle">{description}</p>
      </div>
    </div>
  );
}

export function MyCarrierContractsCard({
  agentId,
}: MyCarrierContractsCardProps) {
  return (
    <AgentCarrierContractsCard
      agentId={agentId}
      title="My Carrier Contracts"
      description="Toggle carriers you are actively contracted with. This helps your downline see which carriers are available."
    />
  );
}
