import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo"],
      },
      colors: {
        bg: { DEFAULT: "var(--bg)", 2: "var(--bg-2)", 3: "var(--bg-3)" },
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
          5: "var(--ink-5)",
        },
        line: { DEFAULT: "var(--line)", 2: "var(--line-2)", 3: "var(--line-3)" },
        accent: {
          DEFAULT: "var(--accent)",
          h: "var(--accent-h)",
          bg: "var(--accent-bg)",
          bd: "var(--accent-bd)",
          ink: "var(--accent-ink)",
        },
        tone: {
          red: { bg: "var(--tone-red-bg)", bd: "var(--tone-red-bd)", ink: "var(--tone-red-ink)" },
          amber: { bg: "var(--tone-amber-bg)", bd: "var(--tone-amber-bd)", ink: "var(--tone-amber-ink)" },
          green: { bg: "var(--tone-green-bg)", bd: "var(--tone-green-bd)", ink: "var(--tone-green-ink)" },
          grey: { bg: "var(--tone-grey-bg)", bd: "var(--tone-grey-bd)", ink: "var(--tone-grey-ink)" },
        },
      },
      borderRadius: { 1: "var(--r-1)", 2: "var(--r-2)", 3: "var(--r-3)", 4: "var(--r-4)" },
      boxShadow: { 1: "var(--sh-1)", 2: "var(--sh-2)", pop: "var(--sh-pop)", ring: "var(--ring)" },
    },
  },
  plugins: [],
};

export default config;
