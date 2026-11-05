// src/lib/vehicleImages.ts
// Ánh xạ hình ảnh thực tế cho các dòng xe trong hệ thống MOTO CARE

export const VEHICLE_IMAGE_MAP: Record<string, string> = {
  // Honda Vision 2023 Smartkey (Hình ảnh thực tế chuẩn từ người dùng cung cấp)
  'honda vision': '/images/vehicles/honda-vision.jpg',
  'vision': '/images/vehicles/honda-vision.jpg',

  // Honda Air Blade 125/160
  'air blade': '/images/vehicles/honda-airblade.png',
  'honda air blade': '/images/vehicles/honda-airblade.png',

  // Honda Wave Alpha 110
  'wave alpha': '/images/vehicles/honda-wave-alpha.png',
  'honda wave': '/images/vehicles/honda-wave-alpha.png',

  // Honda Blade 110
  'honda blade': '/images/vehicles/honda-blade.png',
  'blade': '/images/vehicles/honda-blade.png',

  // Honda Future 125
  'future 125': '/images/vehicles/honda-future.png',
  'honda future': '/images/vehicles/honda-future.png',

  // Honda Lead 125
  'lead 125': '/images/vehicles/honda-lead.png',
  'honda lead': '/images/vehicles/honda-lead.png',

  // Honda Winner X 150 ABS
  'winner x': '/images/vehicles/honda-winner-x.png',
  'honda winner': '/images/vehicles/honda-winner-x.png',

  // Yamaha Grande Hybrid
  'yamaha grande': '/images/vehicles/yamaha-grande.png',
  'grande': '/images/vehicles/yamaha-grande.png',

  // Yamaha Exciter 155 VVA
  'yamaha exciter': '/images/vehicles/yamaha-exciter.png',
  'exciter': '/images/vehicles/yamaha-exciter.png',

  // Yamaha Sirius
  'sirius': '/images/vehicles/honda-blade.png',

  // Phân loại tổng quát (Fallback by category)
  'xe_so': '/images/vehicles/honda-wave-alpha.png',
  'tay_ga': '/images/vehicles/honda-vision.jpg',
  'xe_con': '/images/vehicles/honda-winner-x.png',
};

/**
 * Lấy đường dẫn hình ảnh thực tế của xe dựa theo tên mẫu xe (model) hoặc phân loại (vehicle_type)
 */
export function getVehicleImageUrl(modelOrType?: string | null): string {
  if (!modelOrType) return '/images/vehicles/honda-vision.jpg';
  const lower = modelOrType.toLowerCase();

  for (const [key, url] of Object.entries(VEHICLE_IMAGE_MAP)) {
    if (lower.includes(key)) {
      return url;
    }
  }

  // Fallback mặc định xe tay ga Vision
  return '/images/vehicles/honda-vision.jpg';
}
