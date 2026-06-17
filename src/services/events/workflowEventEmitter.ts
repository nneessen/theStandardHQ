// src/services/events/workflowEventEmitter.ts
// Client-side event emitter that delegates to server-side edge function
// for reliable workflow matching and execution (bypasses RLS issues).
// TODO: is bypassing RLS going to be a security issue?

import { supabase } from "@/services/base/supabase";

interface EventContext {
  userId?: string;
  userEmail?: string;
  organizationId?: string;
  timestamp?: string;
  recruitId?: string;
  policyId?: string;
  commissionId?: string;
  agentId?: string;
  [key: string]: unknown;
}

interface EventEmissionResult {
  success: boolean;
  workflowsTriggered: number;
  errors?: string[];
}

class WorkflowEventEmitter {
  private static instance: WorkflowEventEmitter;

  private constructor() {}

  static getInstance(): WorkflowEventEmitter {
    if (!WorkflowEventEmitter.instance) {
      WorkflowEventEmitter.instance = new WorkflowEventEmitter();
    }
    return WorkflowEventEmitter.instance;
  }

  async emit(
    eventName: string,
    context: EventContext,
  ): Promise<EventEmissionResult> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "trigger-workflow-event",
        {
          body: { eventName, context },
        },
      );

      if (error) {
        console.error(
          `[EventEmitter] Edge function error for ${eventName}:`,
          error,
        );
        return {
          success: false,
          workflowsTriggered: 0,
          errors: [error.message || "Edge function invocation failed"],
        };
      }

      const result: EventEmissionResult = {
        success: data?.success ?? false,
        workflowsTriggered: data?.workflowsTriggered ?? 0,
        errors: data?.matches
          ?.filter(
            (m: { status: string; error?: string }) => m.status === "failed",
          )
          .map(
            (m: { workflowName: string; error?: string }) =>
              `${m.workflowName}: ${m.error}`,
          ),
      };

      if (
        typeof window !== "undefined" &&
        import.meta.env?.DEV &&
        result.workflowsTriggered > 0
      ) {
        const { toast } = await import("sonner");
        toast.success(
          `${result.workflowsTriggered} workflow(s) triggered by ${eventName}`,
        );
      }

      return result;
    } catch (error) {
      console.error(`[EventEmitter] Failed to emit ${eventName}:`, error);
      return {
        success: false,
        workflowsTriggered: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  async emitBatch(
    events: Array<{ eventName: string; context: EventContext }>,
  ): Promise<void> {
    for (const event of events) {
      await this.emit(event.eventName, event.context);
    }
  }
}

export const workflowEventEmitter = WorkflowEventEmitter.getInstance();

// Canonical event names live in @/lib so the workflows feature can import them
// without crossing the services boundary. Re-exported here for back-compat.
export { WORKFLOW_EVENTS } from "@/lib/workflow-event-names";
