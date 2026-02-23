/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'neon-cyan': '#00ffc3',
        'neon-pink': '#ff00c1',
        'dark-bg': '#0a0f0f',
      },
      fontFamily: {
        mono: ['Share Tech Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
