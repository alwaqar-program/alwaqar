/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        display: ['Reem Kufi', 'Cairo', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e6f2f2',
          100: '#bfdedd',
          200: '#94c8c6',
          300: '#69b1ae',
          400: '#48a09c',
          500: '#288e8a',
          600: '#1f7773',
          700: '#155e5b',
          800: '#0d4543',
          900: '#062c2b',
        },
        gold: {
          400: '#d4a857',
          500: '#c39443',
          600: '#a17b34',
        },
      },
    },
  },
  plugins: [],
}
