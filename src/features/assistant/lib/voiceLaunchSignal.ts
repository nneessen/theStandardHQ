// A tiny cross-component signal that lets the global ⌘J / Ctrl+J shortcut ask the
// Command Center to begin a hands-free voice session the instant it mounts — or
// right away if the user is already on the page. It lives outside React because
// the keyboard handler fires from the sidebar (a sibling of the assistant) and
// needs to hand the intent across a route change. Kept deliberately minimal: a
// single pending flag plus listeners — not a general event bus.

type Listener = () => void;

let pending = false;
const listeners = new Set<Listener>();

/** Ask the assistant to start a voice session as soon as it can. */
export function requestVoiceLaunch(): void {
  pending = true;
  // Wake an already-mounted Command Center so it starts without a remount.
  listeners.forEach((fn) => fn());
}

/** Read-and-clear a pending request. The page calls this once it can launch. */
export function consumeVoiceLaunch(): boolean {
  const was = pending;
  pending = false;
  return was;
}

/** Subscribe to launch requests; returns an unsubscribe function. */
export function subscribeVoiceLaunch(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
