/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
    },
  },
  plugins: [
    require("daisyui"),
    require("@tailwindcss/typography") // 👈 typography plugin added here
  ],
  daisyui: {
    themes: ["cupcake", "dark", "corporate"], // try these cool themes
  },
};
