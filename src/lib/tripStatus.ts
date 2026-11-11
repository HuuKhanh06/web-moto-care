import type { RentalRequestStatus } from '@/db/types';

export type TripGroup = 'ACTIVE' | 'PENDING' | 'DONE';
export function getTripGroup(status: RentalRequestStatus): TripGroup {
  if (['DANG_THUE', 'DANG_GIA_HAN', 'DANG_XU_LY_SU_CO'].includes(status)) return 'ACTIVE';
  if (['HOAN_TAT', 'DA_HUY', 'TU_CHOI'].includes(status)) return 'DONE';
  return 'PENDING';
}
