/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: '#0a0e14',
        accent: {
          DEFAULT: '#38bdf8',
          hover: '#0284c7',
        },
        risk: {
          low: '#34d399',
          moderate: '#fbbf24',
          high: '#fb923c',
          severe: '#f87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
