/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Merriweather', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            h1: { fontFamily: theme('fontFamily.heading') },
            h2: { fontFamily: theme('fontFamily.heading') },
            h3: { fontFamily: theme('fontFamily.heading') },
            p: { fontFamily: theme('fontFamily.body') },
            a: { fontFamily: theme('fontFamily.body') },
          },
        },
      }),
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
