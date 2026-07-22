/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        court: '#4a9e6b',
        courtLight: '#5db87e',
        kitchen: '#3d8a5c',
      },
    },
  },
  plugins: [],
}
