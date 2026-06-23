import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#005BAC",
        deep: "#073763",
        snow: "#F5FBFF",
        lake: "#23A9E1",
        moss: "#E8172F",
        accent: "#E8172F"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(7, 55, 99, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
