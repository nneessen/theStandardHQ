// src/features/underwriting/components/QuickQuote/gender-icons.tsx

import type { SVGProps } from "react";

/**
 * Mars symbol — circle with arrow pointing upper-right
 */
export function MaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      {...props}
    >
      {/* Circle */}
      <circle cx="10.5" cy="13.5" r="6" />
      {/* Arrow shaft */}
      <line x1="15" y1="9" x2="21" y2="3" />
      {/* Arrow head */}
      <polyline points="15 3 21 3 21 9" />
    </svg>
  );
}

/**
 * Venus symbol — circle with cross below
 */
export function FemaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      {...props}
    >
      {/* Circle */}
      <circle cx="12" cy="9" r="6" />
      {/* Vertical line below */}
      <line x1="12" y1="15" x2="12" y2="23" />
      {/* Horizontal crossbar */}
      <line x1="9" y1="19" x2="15" y2="19" />
    </svg>
  );
}
