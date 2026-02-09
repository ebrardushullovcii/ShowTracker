/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "brand-background": "#16120d",
        "brand-surface": "#2f2618",
        "brand-primary": "#cf5d3f",
        "brand-text": "#f7e9d0",
        "brand-light-background": "#f3ead8",
        "brand-light-surface": "#fff7e8",
        "brand-light-text": "#2b2114"
      }
    },
  },
  plugins: [],
};
