import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          surface: "#F5F7FA",
          charcoal: "#20242C",
          muted: "#596273",
          border: "#E1E5EC",
          blue: "#2854EB",
          "blue-hover": "#1D44D8",
          "blue-subtle": "#EEF2FD",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-right": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-left": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-out": "fade-out 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-right": "slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-left": "slide-left 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-down": "slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
