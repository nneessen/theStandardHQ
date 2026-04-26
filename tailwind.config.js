/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        error: {
          DEFAULT: "var(--error)",
          foreground: "var(--error-foreground)",
        },
        info: {
          DEFAULT: "var(--info)",
          foreground: "var(--info-foreground)",
        },
        status: {
          active: "var(--success)",
          earned: "var(--info)",
          pending: "var(--warning)",
          lapsed: "var(--error)",
        },
        // Design System V2 — Crextio-inspired soft yellow/cream
        v2: {
          canvas: "var(--v2-bg-canvas)",
          card: "var(--v2-bg-card)",
          "card-tinted": "var(--v2-bg-card-tinted)",
          "card-dark": "var(--v2-bg-card-dark)",
          accent: "var(--v2-accent)",
          "accent-strong": "var(--v2-accent-strong)",
          "accent-soft": "var(--v2-accent-soft)",
          ink: "var(--v2-ink)",
          "ink-muted": "var(--v2-ink-muted)",
          "ink-subtle": "var(--v2-ink-subtle)",
          ring: "var(--v2-ring)",
          "ring-strong": "var(--v2-ring-strong)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // V2 radii
        "v2-sm": "var(--v2-radius-sm)",
        "v2-md": "var(--v2-radius-md)",
        "v2-lg": "var(--v2-radius-lg)",
        "v2-pill": "var(--v2-radius-pill)",
      },
      boxShadow: {
        "v2-soft": "var(--v2-shadow-soft)",
        "v2-lift": "var(--v2-shadow-lift)",
      },
      fontFamily: {
        display: "var(--v2-font-display)",
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-in-out",
        "logo-spin": "logo-spin 1s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "logo-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
