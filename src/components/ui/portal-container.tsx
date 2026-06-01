// src/components/ui/portal-container.tsx
//
// Radix portals (Select / Dropdown / Dialog / Popover / Tooltip / Sheet …)
// mount at document.body by DEFAULT — which is OUTSIDE the `.theme-v2`
// authenticated shell. That means portaled content resolves the GLOBAL `.dark`
// (Slate + Indigo) palette instead of the charcoal "Board" tokens, so menus and
// dialogs visibly mismatch the page.
//
// This provider renders a host node INSIDE the `.theme-v2` shell and exposes it
// via context. Shared ui components pass `container={usePortalContainer()}` to
// their Radix Portal, so portaled content lands inside the theme scope and
// inherits the board tokens.
//
// Leak-proof by construction: public/unauthenticated surfaces never mount this
// provider, so `usePortalContainer()` returns `undefined` there and Radix falls
// back to document.body with the original palette — public pages are untouched.

import { createContext, useContext, useState, type ReactNode } from "react";

const PortalContainerContext = createContext<HTMLElement | null>(null);

/**
 * The themed portal host, or `undefined` when none is mounted (public pages).
 * Pass straight into a Radix `Portal`'s `container` prop — `undefined` makes
 * Radix use its default (document.body).
 */
export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}

/**
 * Mounts a host node for themed portals and provides it to descendants. Place
 * INSIDE the `.theme-v2` shell so the host (and everything portaled into it)
 * inherits the board palette.
 */
export function PortalContainerProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <PortalContainerContext.Provider value={host}>
      {children}
      <div ref={setHost} className="theme-v2-portal-host" />
    </PortalContainerContext.Provider>
  );
}
