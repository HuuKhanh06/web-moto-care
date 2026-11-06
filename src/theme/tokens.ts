// src/theme/tokens.ts
// Design Tokens chuẩn hóa cho giao diện MotoCare thương mại
// Tuân thủ nghiêm ngặt mục 3: Lưới 8px, font Be Vietnam Pro (400 & 600), AA Contrast, Touch 44px+

export const TOKENS = {
  // 1. Phông chữ & Trọng số
  typography: {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    weights: {
      regular: 400,
      semibold: 600,
    },
    scale: {
      // Tiêu đề trang: mobile 24px / desktop 32px, leading 1.25
      pageTitle: 'text-2xl md:text-3xl font-semibold leading-[1.25] tracking-tight text-slate-900',
      // Tiêu đề phân mục: mobile 18px / desktop 20px, leading 1.25
      sectionTitle: 'text-lg md:text-xl font-semibold leading-[1.25] text-slate-900',
      // Nội dung chính: 16px, leading 1.5
      body: 'text-base font-normal leading-relaxed text-slate-800',
      // Chữ phụ / nhãn: 14px, leading 1.4
      caption: 'text-sm font-normal text-slate-500',
      // Chữ nhỏ tối thiểu: 13px (tuyệt đối không dùng dưới 13px)
      small: 'text-[13px] font-normal text-slate-500',
    },
  },

  // 2. Bảng màu chuẩn mực
  colors: {
    // Màu Teal chủ đạo (Primary Accent)
    primary: {
      teal: '#0d9488',      // teal-600
      tealHover: '#0f766e', // teal-700
      tealLight: '#f0fdfa', // teal-50
      tealBorder: '#ccfbf1',// teal-100
      tealDark: '#115e59',  // teal-800
    },

    // Màu nền & Bề mặt (Sáng sủa, sạch sẽ, không dùng Dark mode)
    background: {
      page: 'bg-slate-50',        // Nền trang xám rất nhạt (#f8fafc)
      card: 'bg-white',           // Nền thẻ trắng tinh khiết
      subtle: 'bg-slate-100/70',  // Nền phân tách nhẹ
    },

    // Màu chữ đạt chuẩn tương phản WCAG AA
    text: {
      primary: 'text-slate-900',  // Gần đen (#0f172a)
      secondary: 'text-slate-700',// Xám đậm dễ đọc
      muted: 'text-slate-500',    // Chữ phụ
      inverse: 'text-white',      // Trên nền teal
    },

    // Viền nhẹ 1px
    border: {
      light: 'border-slate-200',  // Viền mỏng 1px (#e2e8f0)
      subtle: 'border-slate-100',
      focus: 'focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20',
    },

    // 4 Màu trạng thái bắt buộc (luôn đi kèm chữ)
    status: {
      success: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      },
      pending: {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      },
      error: {
        bg: 'bg-rose-50',
        text: 'text-rose-800',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      },
      inactive: {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
    },
  },

  // 3. Bo góc chuẩn
  radius: {
    card: 'rounded-xl',       // 12px
    button: 'rounded-xl',     // 12px
    input: 'rounded-xl',      // 12px
    chip: 'rounded-full',     // 999px
  },

  // 4. Kích thước & Vùng chạm
  dimensions: {
    // Chiều cao nút chính và ô nhập: 48px chuẩn công thái học
    buttonHeight: 'h-12 min-h-[48px]',
    inputHeight: 'h-12 min-h-[48px]',
    // Vùng chạm tối thiểu: 44x44px
    touchTarget: 'min-w-[44px] min-h-[44px]',
    // Container desktop tối đa: 1200px
    containerMax: 'max-w-[1200px] mx-auto',
  },

  // 5. Lưới khoảng cách 8px (4, 8, 12, 16, 24, 32, 48)
  spacing: {
    screenPaddingMobile: 'px-4',     // 16px
    screenPaddingDesktop: 'px-6 md:px-8',
    blockGap: 'space-y-6',           // 24px
    cardPadding: 'p-4 md:p-6',       // 16px mobile, 24px desktop
  },
} as const;
