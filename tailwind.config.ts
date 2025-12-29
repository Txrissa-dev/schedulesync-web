import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          primary: "#DA6319",
          "primary-dark": "#C25515",
          "primary-light": "#E87E3D",
          bg: "#FDF2E3",
          secondary: "#49B7E6",
          "secondary-dark": "#3A9FCD",
          "secondary-light": "#6BC7EF",
          success: "#66A21A",
          warning: "#C27B1A",
        },
      },
    },
  },
  plugins: [],
};
export default config;
