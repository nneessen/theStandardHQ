// src/components/ui/resizable-panel.tsx

import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelProps {
  children: React.ReactNode;
  width: number;
  isResizing: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  className?: string;
}

/**
 * ResizablePanel - A wrapper component that makes its content resizable
 *
 * Features a subtle resize handle on the right edge that allows users to
 * drag and adjust the panel width. Follows the project's compact design
 * with zinc palette and minimal visual elements.
 *
 * @example
 * ```tsx
 * <ResizablePanel
 *   width={sidebarWidth}
 *   isResizing={isResizing}
 *   onMouseDown={handleMouseDown}
 *   className="flex flex-col bg-white"
 * >
 *   <YourContent />
 * </ResizablePanel>
 * ```
 */
export const ResizablePanel = React.forwardRef<
  HTMLDivElement,
  ResizablePanelProps
>(({ children, width, isResizing, onMouseDown, className }, ref) => {
  return (
    <div
      ref={ref}
      style={{ width: `${width}px` }}
      className={cn(
        "relative flex-shrink-0",
        !isResizing && "transition-none", // Disable transitions during resize to prevent lag
        className,
      )}
    >
      {children}

      {/* Resize Handle - only show when onMouseDown is provided */}
      {onMouseDown && (
        <div
          onMouseDown={onMouseDown}
          className={cn(
            "absolute top-0 right-0 h-full w-1 cursor-col-resize group",
            "hover:w-1 transition-colors",
            // Extend hitbox for easier grabbing
            'before:absolute before:inset-y-0 before:-inset-x-1 before:w-3 before:content-[""]',
          )}
        >
          {/* Visual indicator */}
          <div
            className={cn(
              "absolute inset-y-0 right-0 w-0.5 transition-all",
              isResizing
                ? "bg-ring opacity-100 w-0.5"
                : "bg-border opacity-0 group-hover:opacity-100 group-hover:bg-ring",
            )}
          />
        </div>
      )}
    </div>
  );
});

ResizablePanel.displayName = "ResizablePanel";
