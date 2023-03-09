/* eslint-env node */
const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        handwriting: ['Shantell Sans', 'sans-serif'],
      },
      keyframes: {
        ...defaultTheme.keyframes,
        spin: {
          from: {
            transform: 'rotate(0deg)',
          },
          to: {
            transform: 'rotate(360deg)',
          },
        },
      },
    },
  },
  plugins: [],
};
