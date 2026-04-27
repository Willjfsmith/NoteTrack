import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo"],
      },
      colors: {
        bg: {
          DEFAULT: "var(--bg)",
          2: "var(--bg-2)",
          3: "var(--bg-3)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
          5: "var(--ink-5)",
        },
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
          3: "var(--line-3)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          h: "var(--accent-h)",
          bg: "var(--accent-bg)",
          bd: "var(--accent-bd)",
          ink: "var(--accent-ink)",
        },
        tone: {
          yellow: { bg: "var(--tone-yellow-bg)", bd: "var(--tone-yellow-bd)", ink: "var(--tone-yellow-ink)" },
          red: { bg: "var(--tone-red-bg)", bd: "var(--tone-red-bd)", ink: "var(--tone-red-ink)" },
          green: { bg: "var(--tone-green-bg)", bd: "var(--tone-green-bd)", ink: "var(--tone-green-ink)" },
          blue: { bg: "var(--tone-blue-bg)", bd: "var(--tone-blue-bd)", ink: "var(--tone-blue-ink)" },
          purple: { bg: "var(--tone-purple-bg)", bd: "var(--tone-purple-bd)", ink: "var(--tone-purple-ink)" },
          orange: { bg: "var(--tone-orange-bg)", bd: "var(--tone-orange-bd)", ink: "var(--tone-orange-ink)" },
          pink: { bg: "var(--tone-pink-bg)", bd: "var(--tone-pink-bd)", ink: "var(--tone-pink-ink)" },
          grey: { bg: "var(--tone-grey-bg)", bd: "var(--tone-grey-bd)", ink: "var(--tone-grey-ink)" },
        },
      },
      borderRadius: {
        1: "var(--r-1)",
        2: "var(--r-2)",
        3: "var(--r-3)",
        4: "var(--r-4)",
        5: "var(--r-5)",
      },
      boxShadow: {
        1: "var(--sh-1)",
        2: "var(--sh-2)",
        3: "var(--sh-3)",
        pop: "var(--sh-pop)",
        ring: "var(--ring)",
      },
    },
  },
  plugins: [],
};

export default config;
