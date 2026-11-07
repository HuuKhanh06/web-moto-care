// src/db/cleanupLegacyMockData.ts
// Bước dọn dẹp một lần dữ liệu giả mạo do các phiên bản mock cũ lưu vào IndexedDB
// Xóa sạch 'NGUYEN VAN A', '079201008888', '1995-05-12' trong process_state và profiles

import { db } from '@/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/authStore';

export interface CleanupReport {
  cleaned: boolean;
  affectedProcessStates: string[];
  affectedProfiles: Array<{ id: string; email?: string; oldName: string; newName: string }>;
}

export async function cleanupLegacyMockData(force = false): Promise<CleanupReport> {
  const CLEANUP_KEY = 'motocare_legacy_mock_cleaned_v2';
  const affectedProcessStates: string[] = [];
  const affectedProfiles: Array<{ id: string; email?: string; oldName: string; newName: string }> = [];

  try {
    // 1. Quét và dọn sạch các biến trích xuất giả trong db.process_state
    const allStates = await db.process_state.toArray();
    for (const state of allStates) {
      const vars = state.variables || {};
      const isMockName = vars.customer_full_name === 'NGUYEN VAN A' || vars.customer_full_name === 'NGUYỄN VĂN A';
      const isMockId = vars.customer_id_number === '079201008888';
      const isMockDob = vars.customer_dob === '1995-05-12' || vars.customer_dob === '2001-10-10';

      if (isMockName || isMockId || isMockDob || force) {
        // Xóa sạch các trường giả định
        const cleanedVars = { ...vars };
        delete cleanedVars.customer_full_name;
        delete cleanedVars.customer_id_number;
        delete cleanedVars.customer_dob;
        delete cleanedVars.customer_license_class;
        delete cleanedVars.customer_address;
        delete cleanedVars.extracted_cccd;
        delete cleanedVars.extracted_gplx;

        await db.process_state.update(state.request_id, {
          variables: cleanedVars,
        });
        affectedProcessStates.push(state.request_id);
      }
    }

    // 2. Quét và khôi phục tên tài khoản bị ghi đè thành 'NGUYEN VAN A' trong db.profiles
    const allProfiles = await db.profiles.toArray();
    for (const prof of allProfiles) {
      if (prof.full_name === 'NGUYEN VAN A' || prof.full_name === 'NGUYỄN VĂN A') {
        const account = await db.auth_accounts.where('user_id').equals(prof.id).first();
        let fallbackName = 'Khách hàng';
        if (account?.email) {
          const emailLower = account.email.toLowerCase();
          if (emailLower.includes('huukhanh')) {
            fallbackName = 'Hữu Khánh';
          } else {
            const prefix = account.email.split('@')[0];
            fallbackName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
          }
        }

        await db.profiles.update(prof.id, {
          full_name: fallbackName,
        });

        // Đồng bộ lên Supabase Cloud nếu có kết nối
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('profiles').update({ full_name: fallbackName }).eq('id', prof.id);
          } catch {
            // Không ngắt luồng nếu offline
          }
        }

        // Cập nhật ngay lập tức currentUser trong authStore nếu đang đăng nhập
        const currentAuthUser = useAuthStore.getState().currentUser;
        if (currentAuthUser && currentAuthUser.id === prof.id) {
          useAuthStore.setState({
            currentUser: { ...currentAuthUser, full_name: fallbackName },
          });
        }

        affectedProfiles.push({
          id: prof.id,
          email: account?.email,
          oldName: prof.full_name,
          newName: fallbackName,
        });
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CLEANUP_KEY, 'true');
    }

    console.info('[cleanupLegacyMockData] Đã dọn dẹp dữ liệu giả:', {
      processStatesCleaned: affectedProcessStates.length,
      profilesCleaned: affectedProfiles.length,
    });

    return {
      cleaned: true,
      affectedProcessStates,
      affectedProfiles,
    };
  } catch (err) {
    console.error('[cleanupLegacyMockData] Lỗi trong quá trình dọn dẹp:', err);
    return {
      cleaned: false,
      affectedProcessStates,
      affectedProfiles,
    };
  }
}
