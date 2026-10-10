/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        basalt: '#120d0a', soil: '#1c1410', clay: '#2a1d16', laterite: '#c9531f', ember: '#e8803a', ochre: '#dcae52',
        mist: '#8fc4bb', teal: '#3f8f89', bone: '#efe4d3', moss: '#74ab78', crimson: '#c0264b',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Hind Siliguri"', '"Hind"', 'system-ui', 'sans-serif'],
        body: ['"Hind"', '"Hind Siliguri"', '"Noto Sans Bengali"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
