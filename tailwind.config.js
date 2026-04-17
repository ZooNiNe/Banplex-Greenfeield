/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        telegram: '0 28px 60px -30px rgba(15, 23, 42, 0.45)',
      },
    },
  },
  plugins: [],
}

