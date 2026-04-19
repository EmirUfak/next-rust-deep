import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        oled: "#020308",
        surface: {
          0: "#070d1b",
          1: "#0d1730",
          2: "#142448",
        },
        neon: {
          cyan: "#2df6ff",
          blue: "#3f8cff",
        },
      },
      borderColor: {
        glass: "rgba(122, 170, 255, 0.35)",
      },
      boxShadow: {
        glass:
          "0 20px 55px rgba(6, 11, 25, 0.6), inset 0 1px 0 rgba(168, 217, 255, 0.1)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(120,156,225,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(120,156,225,0.16) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "26px 26px",
      },
      fontFamily: {
        display: ["var(--font-display)", "Segoe UI", "sans-serif"],
        mono: ["var(--font-code)", "Consolas", "monospace"],
      },
      animation: {
        "rise-in": "rise-in 420ms ease-out",
      },
      keyframes: {
        "rise-in": {
          "0%": {
            transform: "translateY(12px)",
            opacity: "0",
          },
          "100%": {
            transform: "translateY(0)",
            opacity: "1",
          },
        },
      },
    },
  },
};

export default config;
