import type { Config } from "tailwindcss"
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
      colors: {
        bg: "#05060A",
        panel: "#0D1322",
        border: "#202A40",
        fraud: "#FF3B3B",
        warning: "#FF9F1C",
        success: "#2EE59D",
        info: "#4DA3FF",
        "panel-glow": "rgba(77, 163, 255, 0.15)",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
        "glass-inset": "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
        glow: "0 0 20px 0 var(--panel-glow)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
}
export default config
