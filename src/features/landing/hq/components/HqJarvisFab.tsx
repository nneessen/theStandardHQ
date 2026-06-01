/*
 * Floating "Ask Jarvis" launcher (pulsing conic ring). The public page has no
 * live assistant, so this is an in-page anchor that scrolls to the Jarvis
 * showcase (#jarvis), where the CTA invites the visitor to apply.
 */

export function HqJarvisFab() {
  return (
    <a className="jv-fab" href="#jarvis" aria-label="Ask Jarvis">
      <span className="jv-fab-orb" />
      <span className="jv-fab-label">Ask Jarvis</span>
      <span className="jv-fab-key">⌘J</span>
    </a>
  );
}
