// src/components/layout/AppShell.tsx
// Layout shell that owns fixed-sidebar spacing and main content positioning.

import React from "react";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  isSidebarCollapsed: boolean;
  onLogout?: () => void;
  onToggleSidebar: () => void;
  userEmail: string;
  userName: string;
}

export function AppShell({
  children,
  isSidebarCollapsed,
  onLogout,
  onToggleSidebar,
  userEmail,
  userName,
}: AppShellProps) {
  return (
    <div className="flex flex-1">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
        userName={userName}
        userEmail={userEmail}
        onLogout={onLogout}
      />
      <div
        className={cn(
          "flex-1 min-w-0 transition-[margin] duration-200",
          isSidebarCollapsed ? "md:ml-[96px]" : "md:ml-[244px]",
        )}
      >
        <div className="p-6 w-full min-h-screen">{children}</div>
      </div>
    </div>
  );
}
