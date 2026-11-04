/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ECFAF2',
          100: '#D3F3E2',
          300: '#7ADDAB',
          500: '#00A651', // Xanh chính: icon, viền, thanh tiến trình, nền nhạt
          600: '#00914A',
          700: '#00803F', // Nền nút chính & chữ xanh trên nền trắng (tương phản WCAG AA >= 4.5:1)
          900: '#0B3D26', // Tiêu đề trên nền xanh nhạt
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
