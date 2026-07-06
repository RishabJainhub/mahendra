/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: "#fbeaea",
          100: "#f3cccc",
          200: "#e29a9a",
          300: "#cf6767",
          400: "#b93838",
          500: "#8f1f1f",
          600: "#7a1818",
          700: "#5f1212",
          800: "#4a0e0e",
          900: "#2e0808",
          DEFAULT: "#5f1212",
        },
        gold: {
          50: "#fbf6e6",
          100: "#f5e9c0",
          200: "#ecd28a",
          300: "#dcb44a",
          400: "#c89a2a",
          500: "#a87d18",
          600: "#856213",
          700: "#5e4410",
          800: "#3e2d0c",
          DEFAULT: "#a87d18",
        },
        ivory: {
          50: "#fffef8",
          100: "#fdf9ec",
          200: "#f7efd5",
          300: "#efe3bd",
          400: "#e3d2a0",
          DEFAULT: "#fdf9ec",
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Playfair Display"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      animation: {
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.45", transform: "translateY(0)" },
          "50%": { opacity: "1", transform: "translateY(4px)" },
        },
      },
    },
  },
  plugins: [],
};
