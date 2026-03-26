// src/features/close-kpi/components/ConnectionGate.tsx

import React from "react";
import { Link } from "@tanstack/react-router";
import { CloseCrmIcon } from "@/components/icons/CloseCrmIcon";
import { Button } from "@/components/ui/button";

export const ConnectionGate: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="mb-4 rounded-full bg-muted p-4">
      <CloseCrmIcon className="h-8 w-8 text-muted-foreground" />
    </div>
    <h2 className="mb-1 text-sm font-semibold text-foreground">
      Connect Close CRM
    </h2>
    <p className="mb-4 max-w-sm text-[11px] text-muted-foreground">
      Connect your Close account to start tracking lead metrics, pipeline
      health, and activity KPIs.
    </p>
    <Link to="/chat-bot">
      <Button variant="outline" size="sm" className="text-[11px]">
        Go to Chat Bot Setup
      </Button>
    </Link>
  </div>
);
