import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { agentTheme } from "../../lib/agentTheme";

interface Props {
  agentKey?: string | null;
}

/**
 * Flashes a "SPECIALIST ONLINE" banner whenever the routed agent changes, tinted
 * with that specialist's accent. Auto-dismisses after a few seconds.
 */
export function AgentBanner({ agentKey }: Props) {
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!agentKey) return;
    setShown(agentKey);
    const t = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(t);
  }, [agentKey]);

  const theme = agentTheme(shown);
  const Icon = theme.icon;

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex items-center gap-3 rounded-full border px-4 py-1.5 backdrop-blur-sm"
            style={{
              borderColor: `${theme.accent}66`,
              background: `${theme.accent}14`,
              boxShadow: `0 0 24px ${theme.accent}33`,
            }}
          >
            <Icon className="h-4 w-4" style={{ color: theme.accent }} />
            <div className="leading-tight">
              <div
                className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: theme.accent }}
              >
                Specialist online
              </div>
              <div className="text-xs font-medium text-foreground">
                {theme.label}
                <span className="ml-2 text-muted-foreground">
                  {theme.tagline}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
