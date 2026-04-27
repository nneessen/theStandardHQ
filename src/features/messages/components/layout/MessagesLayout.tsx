// src/features/messages/components/layout/MessagesLayout.tsx
// Two-panel layout for messages with zinc palette styling

import { ReactNode } from "react";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { useResizableSidebar } from "@/hooks";

interface MessagesLayoutProps {
  list: ReactNode;
  detail: ReactNode;
}

export function MessagesLayout({ list, detail }: MessagesLayoutProps) {
  // Resizable sidebar for Email thread list
  const emailSidebar = useResizableSidebar({
    storageKey: "messages-email-sidebar-width",
    defaultWidth: 288,
    minWidth: 200,
    maxWidth: 500,
  });

  return (
    <div className="h-full flex gap-2">
      {/* Thread list - resizable */}
      <ResizablePanel
        width={emailSidebar.width}
        isResizing={emailSidebar.isResizing}
        onMouseDown={emailSidebar.handleMouseDown}
        className="overflow-hidden bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft"
      >
        <div className="h-full overflow-auto">{list}</div>
      </ResizablePanel>

      {/* Detail view - flexible width */}
      <div className="flex-1 overflow-hidden">{detail}</div>
    </div>
  );
}
