import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff5f0", 100: "#ffe8de", 200: "#ffd1bf", 300: "#ffb59e",
          400: "#ff8a66", 500: "#f97316", 600: "#ea580c", 700: "#c2410c",
          800: "#9a3412", 900: "#7c2d12",
        },
        cream: "#fffaf3",
        ink: "#1c1917",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 2px 16px rgba(28,25,23,0.08)", lift: "0 12px 32px rgba(28,25,23,0.14)" },
    },
  },
  plugins: [],
} satisfies Config;
