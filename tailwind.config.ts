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
        forest: {
          canvas: "#0C1310",
          sidebar: "#101A16",
          panel: "#121E19",
          card: "#15231D",
          active: "#162620",
          border: "#22352B",
          "border-subtle": "#1A2A22",
          "border-active": "#284234",
          sage: "#8EA690",
          "sage-hover": "#7D967F",
          "sage-light": "#C5D8C7",
          "sage-dark": "#0C1310",
          text: "#EAF0EB",
          muted: "#8FA396",
          subtle: "#586C61",
        },
        brand: {
          surface: "#101A16",
          charcoal: "#0C1310",
          muted: "#8FA396",
          border: "#22352B",
          blue: "#8EA690",
          "blue-hover": "#7D967F",
          "blue-subtle": "#162620",
        },
      },
      fontFamily: {
        serif: ["'Playfair Display'", "Georgia", "serif"],
        sans: ["'Plus Jakarta Sans'", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "var(--font-geist-mono)", "'Cascadia Code'", "monospace"],
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
