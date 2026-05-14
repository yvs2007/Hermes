import type { Config } from "tailwindcss";

/**
 * Verity — Tailwind config
 * Newspaper design tokens are mirrored from mockup.html so the visual fidelity
 * of the broadsheet aesthetic survives the port from static HTML to React.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/hooks/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2.5rem",
      screens: {
        "2xl": "1240px",
      },
    },
    extend: {
      colors: {
        paper: "#f7f3eb",
        ink: {
          DEFAULT: "#161412",
          soft: "#4a423a",
        },
        rule: "#1a1714",
        accent: {
          DEFAULT: "#7a1d1d",
        },
        "tag-bg": "#efe7d6",
        "callout-bg": "#efe6d2",
        "chip-bg": "#ece3cf",
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        serif: ['"Source Serif 4"', "Georgia", '"Times New Roman"', "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "masthead-xl": ["76px", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "lead-headline": ["52px", { lineHeight: "1.04", letterSpacing: "-0.01em" }],
        "lead-deck": ["22px", { lineHeight: "1.3" }],
        eyebrow: ["11px", { lineHeight: "1.4", letterSpacing: "0.14em" }],
        dateline: ["11px", { lineHeight: "1.4", letterSpacing: "0.08em" }],
      },
      borderWidth: {
        rule: "4px",
      },
      letterSpacing: {
        eyebrow: "0.14em",
        dateline: "0.08em",
      },
      columns: {
        broadsheet: "2",
      },
      gap: {
        "col-broadsheet": "30px",
      },
    },
  },
  plugins: [],
};

export default config;
