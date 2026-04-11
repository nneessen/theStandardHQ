// src/features/training-modules/hooks/useDebouncedField.ts
import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook for debounced field editing. Provides immediate local state
 * updates for responsive UI while debouncing the save callback.
 *
 * Keeps local state authoritative while the user is typing and for a
 * short settling window after the save fires, preventing query-cache
 * updates from overwriting what the user typed.
 *
 * Returns a tuple: [localValue, setValue, flush]
 *   - flush() — force any pending debounced save to fire immediately.
 *               Call this when a parent (e.g., a drawer) is about to unmount
 *               so in-flight edits aren't dropped.
 *
 * @param serverValue - The current value from the server/query cache
 * @param onSave - Callback to persist the value (e.g., mutation)
 * @param delay - Debounce delay in ms (default 500)
 */
export function useDebouncedField<T>(
  serverValue: T,
  onSave: (value: T) => void,
  delay = 500,
): [T, (value: T) => void, () => void] {
  const [localValue, setLocalValue] = useState(serverValue);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the latest value and save callback via refs so flush() can pull
  // them without being recreated on every render.
  const latestValueRef = useRef<T>(serverValue);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync from server only when the field is NOT dirty (user not editing)
  useEffect(() => {
    if (!dirtyRef.current) {
      setLocalValue(serverValue);
      latestValueRef.current = serverValue;
    }
  }, [serverValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const setValue = useCallback(
    (value: T) => {
      dirtyRef.current = true;
      setLocalValue(value);
      latestValueRef.current = value;

      // Clear any pending timers
      if (timerRef.current) clearTimeout(timerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);

      timerRef.current = setTimeout(() => {
        onSaveRef.current(value);
        timerRef.current = null;
        // Keep dirty for a settling window so query-cache refetch
        // doesn't overwrite the input while the mutation propagates
        settleTimerRef.current = setTimeout(() => {
          dirtyRef.current = false;
        }, 1000);
      }, delay);
    },
    [delay],
  );

  /**
   * Force any pending debounced save to fire now. Safe to call when there's
   * nothing pending (no-op in that case).
   */
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      onSaveRef.current(latestValueRef.current);
      // Reset settling window just like a normal debounced fire would
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        dirtyRef.current = false;
      }, 1000);
    }
  }, []);

  return [localValue, setValue, flush];
}
