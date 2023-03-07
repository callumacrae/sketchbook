/* eslint-env node */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        handwriting: ['The Happy Giraffe', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
