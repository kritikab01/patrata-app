/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0A',
        page: '#F4F4F5',
        cardborder: '#E4E4E7',
        muted: '#52525B',
        brand: {
          DEFAULT: '#1E4FD8',
          50: '#EEF2FC',
          100: '#DCE5F8',
          600: '#1A44BE',
          700: '#173A9E',
        },
        approve: '#047857',
        refer: '#B45309',
        decline: '#B42318',
      },
      fontFamily: {
        archivo: ['Archivo', 'system-ui', 'sans-serif'],
        figtree: ['Figtree', 'system-ui', 'sans-serif'],
        deva: ['"Noto Sans Devanagari"', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
        btn: '10px',
      },
    },
  },
  plugins: [],
};
