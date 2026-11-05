/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 1. Tông màu Primary (Cyan - #1EC1CB) và các sắc độ mở rộng
        primary: {
          50: '#F0FAFB',        // primary-50: Nền siêu nhạt (hover bảng, card tint)
          100: '#DDF5F7',       // primary-light: Nền badge, pill chọn nhạt
          200: '#B8EDF0',       // Viền thẻ nhạt
          300: '#8AE1E7',       // Viền trạng thái
          400: '#4DD3DC',       // Màu sáng bổ trợ
          DEFAULT: '#1EC1CB',  // primary / primary-500: Cyan chủ đạo (Button, Icon, Active, Progress)
          500: '#1EC1CB',
          hover: '#17A8B1',    // primary-hover: Màu hover đậm hơn cho button & link
          600: '#17A8B1',      // primary-600
          dark: '#12868E',     // primary-dark: Text nhấn tương phản cao, viền active
          700: '#12868E',
          800: '#0E666C',
          900: '#09454A',
        },

        // 2. Tông màu Secondary / Dark (Deep Navy - #1C1C28)
        navy: {
          50: '#F6F6F9',        // Nền khối xám nhạt trung tính
          100: '#E8E8EE',       // Viền nhạt
          200: '#D0D0DC',
          300: '#A3A3B8',       // Text phụ trên nền tối
          400: '#7E7E96',
          500: '#5E5E76',
          light: '#282838',     // navy-light / navy-800: Card tối, popover, thanh tìm kiếm tối
          800: '#282838',
          DEFAULT: '#1C1C28',  // navy / navy-900: Deep Navy chữ chính, tiêu đề, header tối
          900: '#1C1C28',
          dark: '#13131C',      // navy-dark / navy-950: Nền footer, sidebar siêu tối
          950: '#13131C',
        },

        // 3. Đồng bộ bí danh 'brand' sang dải Cyan mới (Bảo đảm tương thích toàn bộ component hiện hữu)
        brand: {
          50: '#F0FAFB',
          100: '#DDF5F7',
          200: '#B8EDF0',
          300: '#8AE1E7',
          400: '#4DD3DC',
          500: '#1EC1CB',       // Thay thế cho #00A651 cũ
          600: '#17A8B1',       // Thay thế cho #00914A cũ
          700: '#12868E',       // Thay thế cho #00803F cũ (WCAG AA)
          800: '#0E666C',
          900: '#09454A',
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
