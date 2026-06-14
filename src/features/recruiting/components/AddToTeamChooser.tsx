// AddToTeamChooser — a single entry point that asks "who are you adding?" and
// routes to the right flow: Prospect, Recruit (with the post-add pipeline
// wizard), or Agent. Encapsulates the chooser UI + all three add dialogs so a
// caller (e.g. the dashboard Quick Actions) only mounts one component.
//
// Option copy is kept in sync with RecruitingAddButtons tooltips — the canonical
// prospect/recruit/agent explanations.

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Users, UserPlus, UserCheck, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AddProspectDialog } from "./AddProspectDialog";
import { AddRecruitDialog } from "./AddRecruitDialog";
import { AddAgentDialog } from "./AddAgentDialog";
import { PostAddRecruitWizard } from "./PostAddRecruitWizard";

export interface AddToTeamChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Choice = "prospect" | "recruit" | "agent";

interface Option {
  key: Choice;
  icon: LucideIcon;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    key: "prospect",
    icon: Users,
    label: "Prospect",
    description:
      "Someone you're talking to who's interested in joining but hasn't committed yet. No account, no email — just a follow-up contact.",
  },
  {
    key: "recruit",
    icon: UserPlus,
    label: "Recruit",
    description:
      "Someone who's interested and ready to commit — runs them through a licensing pipeline.",
  },
  {
    key: "agent",
    icon: UserCheck,
    label: "Agent",
    description:
      "Already a licensed agent — adds them to your team (you're their upline) and skips the pipelines.",
  },
];

export function AddToTeamChooser({
  open,
  onOpenChange,
}: AddToTeamChooserProps) {
  const navigate = useNavigate();
  const [active, setActive] = useState<Choice | null>(null);
  const [wizardState, setWizardState] = useState<{
    recruitId: string;
    recruitName: string;
    isLicensed: boolean;
    skippedPipeline: boolean;
  } | null>(null);

  const choose = (key: Choice) => {
    onOpenChange(false);
    setActive(key);
  };

  return (
    <>
      {/* Step 1 — the chooser */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Add to your team</DialogTitle>
            <DialogDescription className="text-sm">
              Pick what you&apos;re adding — each one works a little
              differently.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            {OPTIONS.map((o) => {
              const Icon = o.icon;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => choose(o.key)}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-foreground">
                      {o.label}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {o.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2 — the chosen add flow */}
      <AddProspectDialog
        open={active === "prospect"}
        onOpenChange={(o) => !o && setActive(null)}
      />

      <AddRecruitDialog
        open={active === "recruit"}
        onOpenChange={(o) => !o && setActive(null)}
        onSuccess={(recruitId, meta) => {
          setActive(null);
          setWizardState({
            recruitId,
            recruitName: meta.fullName,
            isLicensed: meta.isLicensed,
            skippedPipeline: meta.skippedPipeline,
          });
        }}
      />

      <AddAgentDialog
        open={active === "agent"}
        onOpenChange={(o) => !o && setActive(null)}
      />

      {/* Recruit pipeline-assignment wizard */}
      <PostAddRecruitWizard
        open={!!wizardState}
        onOpenChange={(o) => {
          if (!o) setWizardState(null);
        }}
        recruitId={wizardState?.recruitId ?? null}
        recruitName={wizardState?.recruitName ?? ""}
        isLicensed={wizardState?.isLicensed ?? false}
        skippedPipeline={wizardState?.skippedPipeline ?? false}
        onComplete={() => {
          const id = wizardState?.recruitId;
          setWizardState(null);
          if (id) {
            navigate({
              to: "/recruiting/$recruitId",
              params: { recruitId: id },
            });
          }
        }}
      />
    </>
  );
}
