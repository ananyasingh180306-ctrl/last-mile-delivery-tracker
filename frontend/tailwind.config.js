/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lm: {
          ink: "#14181F",
          steel: "#1E2530",
          "steel-2": "#262E3B",
          line: "#333D4C",
          fog: "#C7CDD6",
          "fog-dim": "#8A93A3",
          amber: "#FF7A1A",
          teal: "#2FA88C",
          red: "#E5484D"
        }
      }
    },
  },
  plugins: [],
}
