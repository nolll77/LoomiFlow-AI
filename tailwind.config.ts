import type { Config } from "tailwindcss"
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#05060A",
        panel: "#0B0F1A",
        border: "#1C2333",
        fraud: "#FF3B3B",
        warning: "#FF9F1C",
        success: "#2EE59D",
        info: "#4DA3FF",
      },
    },
  },
  plugins: [],
}
export default config
