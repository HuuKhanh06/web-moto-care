// src/components/ui/VehicleCard.tsx
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { getVehicleImageUrl } from '@/lib/vehicleImages';

export interface VehicleCardProps {
  id: string;
  name: string;
  categoryName: string;
  dailyPrice: number;
  imageUrl?: string;
  statusLabel?: string;
  isAvailable?: boolean;
  onSelect: (id: string) => void;
  className?: string;
  selected?: boolean;
}

/**
 * Thẻ xe thương mại chuẩn mực:
 * - Ảnh lớn rõ ràng (tỷ lệ 16:10), không méo ảnh.
 * - Tên xe to rõ (font 600, 18px).
 * - Phân loại xe & Giá thuê niêm yết/ngày minh bạch (không phí ẩn).
 * - Đúng 1 nút chính nổi bật "Chọn xe" (48px, Teal).
 */
export function VehicleCard({
  id,
  name,
  categoryName,
  dailyPrice,
  imageUrl,
  isAvailable = true,
  onSelect,
  className,
  selected = false,
}: VehicleCardProps) {
  const resolvedImage = imageUrl || getVehicleImageUrl(name);

  return (
    <div
      className={cn(
        'group bg-white rounded-xl border transition-all duration-200 overflow-hidden flex flex-col',
        selected
          ? 'border-teal-600 ring-2 ring-teal-600/20 shadow-md'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm',
        className
      )}
    >
      {/* Khung ảnh xe lớn */}
      <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
        <img
          src={resolvedImage}
          alt={name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-[13px] font-medium bg-white/95 text-slate-800 shadow-xs border border-slate-200/60">
            {categoryName}
          </span>
        </div>
      </div>

      {/* Thông tin cốt lõi */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 leading-snug line-clamp-1">
            {name}
          </h3>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold text-teal-700 tracking-tight">
              {dailyPrice.toLocaleString('vi-VN')} ₫
            </span>
            <span className="text-sm font-normal text-slate-500">/ ngày</span>
          </div>
        </div>

        {/* Nút hành động duy nhất */}
        <Button
          type="button"
          variant={selected ? 'secondary' : 'primary'}
          size="md"
          fullWidth
          disabled={!isAvailable}
          onClick={() => onSelect(id)}
          className="mt-1"
        >
          {selected ? 'Đang chọn' : isAvailable ? 'Chọn xe' : 'Đang có khách'}
        </Button>
      </div>
    </div>
  );
}
