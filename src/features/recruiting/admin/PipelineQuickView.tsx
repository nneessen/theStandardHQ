// src/features/recruiting/admin/PipelineQuickView.tsx
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Mail, Bell, MessageSquare, ChevronDown } from "lucide-react";

interface PipelineQuickViewProps {
  pipeline: {
    id: string;
    name: string;
    description?: string;
    phases: Array<{
      id: string;
      phase_name: string;
      phase_description?: string;
      phase_order: number;
      checklist_items: Array<{
        id: string;
        item_name: string;
        item_type: string;
        is_required: boolean;
      }>;
      automations: Array<{
        id: string;
        trigger_type: string;
        communication_type: string;
        recipients: any;
      }>;
    }>;
  };
}

export function PipelineQuickView({ pipeline }: PipelineQuickViewProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const togglePhase = (phaseId: string) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  };

  return (
    <div className="space-y-2">
      <div className="pb-2 border-b">
        <h3 className="font-medium">{pipeline.name}</h3>
        {pipeline.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {pipeline.description}
          </p>
        )}
      </div>

      <div className="w-full space-y-1">
        {pipeline.phases.map((phase) => (
          <div
            key={phase.id}
            className="border-b border-muted dark:border-muted"
          >
            <button
              onClick={() => togglePhase(phase.id)}
              className="w-full text-left text-sm hover:bg-muted dark:hover:bg-muted py-2 px-1 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    expandedPhases.has(phase.id) ? "rotate-0" : "-rotate-90"
                  }`}
                />
                <div className="w-6 h-6 rounded-full bg-info/20 text-info text-xs flex items-center justify-center font-medium">
                  {phase.phase_order}
                </div>
                <span>{phase.phase_name}</span>
                <Badge variant="secondary" className="ml-auto mr-2">
                  {phase.checklist_items.length} items
                </Badge>
              </div>
            </button>
            {expandedPhases.has(phase.id) && (
              <div className="pl-8 space-y-2 pb-2">
                {/* Checklist Items */}
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">
                    Checklist Items:
                  </h5>
                  <ul className="space-y-1">
                    {phase.checklist_items.map((item) => (
                      <li
                        key={item.id}
                        className="text-xs flex items-center gap-2"
                      >
                        <div
                          className={`w-1 h-1 rounded-full ${item.is_required ? "bg-destructive" : "bg-muted"}`}
                        />
                        <span>{item.item_name}</span>
                        <Badge variant="outline" className="text-xs px-1">
                          {item.item_type}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Automations */}
                {phase.automations.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1">
                      Automations:
                    </h5>
                    <ul className="space-y-1">
                      {phase.automations.map((auto) => (
                        <li
                          key={auto.id}
                          className="text-xs flex items-center gap-2"
                        >
                          <div className="flex items-center gap-1">
                            {auto.communication_type.includes("email") && (
                              <Mail className="h-3 w-3 text-info" />
                            )}
                            {auto.communication_type.includes(
                              "notification",
                            ) && <Bell className="h-3 w-3 text-warning" />}
                            {auto.communication_type.includes("sms") && (
                              <MessageSquare className="h-3 w-3 text-success" />
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {auto.trigger_type.replace(/_/g, " ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
