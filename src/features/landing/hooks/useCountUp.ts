// src/features/landing/hooks/useCountUp.ts
// Hook for animating number count-up

import { useState, useEffect, useRef } from "react";

interface UseCountUpOptions {
  /**
   * Starting value
   * @default 0
   */
  start?: number;

  /**
   * Animation duration in milliseconds
   * @default 2000
   */
  duration?: number;

  /**
   * Decimal places to show
   * @default 0
   */
  decimals?: number;

  /**
   * Easing function
   * @default 'easeOutExpo'
   */
  easing?: "linear" | "easeOut" | "easeOutExpo" | "easeOutQuart";

  /**
   * Whether to start the animation
   * @default true
   */
  enabled?: boolean;

  /**
   * Delay before animation starts (ms)
   * @default 0
   */
  delay?: number;

  /**
   * Separator for thousands
   * @default ','
   */
  separator?: string;
}

// Easing functions
const easings = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
};

/**
 * Hook for animating a number from start to end
 */
export function useCountUp(
  end: number,
  options: UseCountUpOptions = {},
): {
  value: number;
  formattedValue: string;
  isAnimating: boolean;
  reset: () => void;
} {
  const {
    start = 0,
    duration = 2000,
    decimals = 0,
    easing = "easeOutExpo",
    enabled = true,
    delay = 0,
    separator = ",",
  } = options;

  const [value, setValue] = useState(start);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  // Mirrors the currently displayed value without retriggering the effect. When
  // `end` arrives asynchronously (a value fetched after mount), this lets the
  // re-animation ease from where the display actually is instead of snapping
  // back to `start`. It also replaces the prior one-shot guard that left async
  // values frozen at their initial (often 0) value once the first run completed.
  const valueRef = useRef(start);

  const reset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    valueRef.current = start;
    setValue(start);
    setIsAnimating(false);
    startTimeRef.current = null;
  };

  useEffect(() => {
    if (!enabled) return;

    const fromValue = valueRef.current;
    // Already at the target — nothing to animate. Also short-circuits the no-op
    // 0→0 first render before async data has loaded.
    if (fromValue === end) return;

    const startAnimation = () => {
      setIsAnimating(true);
      startTimeRef.current = null;

      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easings[easing](progress);
        const currentValue = fromValue + (end - fromValue) * easedProgress;

        valueRef.current = currentValue;
        setValue(currentValue);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          valueRef.current = end;
          setValue(end);
          setIsAnimating(false);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    if (delay > 0) {
      const timeoutId = setTimeout(startAnimation, delay);
      return () => {
        clearTimeout(timeoutId);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      startAnimation();
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [enabled, end, duration, easing, delay]);

  // Format the value with separator and decimals
  const formattedValue = formatNumber(value, decimals, separator);

  return { value, formattedValue, isAnimating, reset };
}

/**
 * Format a number with thousands separator and decimal places
 */
function formatNumber(
  value: number,
  decimals: number,
  separator: string,
): string {
  const fixed = value.toFixed(decimals);
  const [whole, decimal] = fixed.split(".");

  // Add thousands separator
  const withSeparator = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return decimal ? `${withSeparator}.${decimal}` : withSeparator;
}

/**
 * Component-friendly hook that combines count-up with scroll trigger
 */
export function useCountUpOnScroll(
  end: number | string,
  options: UseCountUpOptions & {
    triggerOnce?: boolean;
    threshold?: number;
  } = {},
): {
  ref: React.RefObject<HTMLDivElement | null>;
  value: number;
  formattedValue: string;
  isAnimating: boolean;
  isVisible: boolean;
} {
  const { triggerOnce = true, threshold = 0.5, ...countUpOptions } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Parse the end value (handle strings like "$75,000")
  const numericEnd =
    typeof end === "string" ? parseFloat(end.replace(/[^0-9.-]/g, "")) : end;

  const { value, formattedValue, isAnimating } = useCountUp(numericEnd, {
    ...countUpOptions,
    enabled: isVisible,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [triggerOnce, threshold]);

  return { ref, value, formattedValue, isAnimating, isVisible };
}
