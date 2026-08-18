/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/browser/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#17146E',
          dark: '#0F0D45'
        }
      }
    }
  },
  plugins: []
};
