// src/components/custom_ui/EmailIcon.tsx

import React from "react";

/**
 * Email icon component for verification screen
 */
export const EmailIcon: React.FC = () => {
  return (
    <div className="flex justify-center">
      <div className="rounded-full bg-accent p-4">
        <svg
          className="h-12 w-12 text-accent-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
    </div>
  );
};
