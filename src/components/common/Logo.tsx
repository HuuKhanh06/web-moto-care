// src/components/common/Logo.tsx
// Logo nhận diện thương hiệu chuẩn hiện đại MOTO CARE


interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export function Logo({ className = '', size = 'md', showSubtitle = false }: LogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Icon biểu trưng: Vành bánh xe phong cách Eco-Green & Tia tốc độ */}
      <div
        className={`${iconSizes[size]} relative flex items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-700 via-brand-600 to-emerald-400 text-white font-black shadow-sm ring-1 ring-white/30`}
      >
        <svg
          className="w-5 h-5 drop-shadow-xs"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Bánh xe & Vòng quay xanh */}
          <circle cx="12" cy="12" r="9" strokeOpacity="0.4" strokeWidth="1.8" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="white" strokeWidth="2.6" />
          <path d="M7 15l5-6 5 6" stroke="white" strokeWidth="2.2" />
        </svg>
      </div>

      <div className="flex flex-col leading-none whitespace-nowrap shrink-0">
        <div className={`font-extrabold tracking-tight ${textSizes[size]} text-slate-900 inline-flex items-center`}>
          <span>MOTO</span>
          <span className="text-brand-600 ml-1 inline-flex items-center">
            CARE
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5"></span>
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase mt-0.5 whitespace-nowrap">
            Smart Mobility
          </span>
        )}
      </div>
    </div>
  );
}
